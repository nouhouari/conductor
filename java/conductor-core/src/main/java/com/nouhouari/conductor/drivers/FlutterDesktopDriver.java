package com.nouhouari.conductor.drivers;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.nouhouari.conductor.config.FlutterDesktopConfig;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.WebSocket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Java port of src/drivers/FlutterDesktopDriver.ts. Drives a Flutter desktop
 * app built with {@code enableFlutterDriverExtension()}: spawns the
 * executable, scrapes the Dart VM service URL off stdout, opens a raw
 * WebSocket to it, and issues JSON-RPC 2.0 calls to the
 * {@code ext.flutter.driver} service extension. No Dart-side custom code
 * is required, matching the TS original.
 *
 * <p>The single biggest porting gotcha (not present in the TS version, which
 * uses the {@code ws} npm package): {@link WebSocket.Listener#onText} may
 * deliver a message across multiple calls ({@code last=false} until a final
 * {@code last=true} fragment), unlike {@code ws}, which reassembles whole
 * frames before emitting. Fragments are buffered per-connection and only
 * parsed once {@code last==true} — otherwise large payloads (notably the
 * base64 PNG from {@link #takeScreenshot}) can intermittently fail to parse
 * depending on how the JDK chunks frames.
 */
public class FlutterDesktopDriver {

    public enum FinderType { ByValueKey, ByText, ByType, ByTooltipMessage }

    public record Finder(FinderType type, String value) {
    }

    public enum OffsetType { topLeft, topRight, bottomLeft, bottomRight, center }

    public record Offset(double dx, double dy) {
    }

    public enum WaitCondition { NoPendingFrames, NoTransientCallbacks, FirstFrameRasterized }

    private static final Pattern VM_URL =
            Pattern.compile("(?:Dart VM service|Observatory) is listening on (https?://\\S+)", Pattern.CASE_INSENSITIVE);

    private final FlutterDesktopConfig cfg;
    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper json = new ObjectMapper();

    private Process process;
    private WebSocket ws;
    private String isolateId;
    private final AtomicInteger nextRpcId = new AtomicInteger(1);
    private final Map<Integer, CompletableFuture<JsonNode>> pending = new ConcurrentHashMap<>();
    private boolean textEntryEmulationEnabled = false;

    public FlutterDesktopDriver(FlutterDesktopConfig cfg) {
        this.cfg = cfg;
    }

    public boolean isLaunched() {
        return ws != null && isolateId != null;
    }

    public void launch() {
        if (isLaunched()) {
            return;
        }
        Path exe = Paths.get(cfg.appPath());
        if (!Files.exists(exe)) {
            throw new IllegalStateException("Flutter desktop executable not found: " + exe
                    + "\nBuild it first, e.g. `flutter build macos --profile -t lib/main_test.dart`.");
        }

        List<String> cmd = new ArrayList<>();
        cmd.add(exe.toString());
        if (cfg.extraArgs() != null) {
            cmd.addAll(cfg.extraArgs());
        }
        if (cfg.vmServicePort() != null) {
            cmd.add("--vm-service-port=" + cfg.vmServicePort());
        }

        int launchTimeoutMs = cfg.launchTimeoutMs() != null ? cfg.launchTimeoutMs() : 30_000;
        try {
            ProcessBuilder pb = new ProcessBuilder(cmd).redirectErrorStream(true);
            if (cfg.env() != null) {
                pb.environment().putAll(cfg.env());
            }
            process = pb.start();

            String vmUrl = waitForVmServiceUrl(process, launchTimeoutMs);
            connectWebSocket(toWsUri(vmUrl));
            resolveIsolateAndDriverExtension(launchTimeoutMs);
        } catch (IOException | URISyntaxException e) {
            throw new RuntimeException("Failed to launch FlutterDesktopDriver", e);
        }
    }

    /** Alternate path for an already-running app (mobile via adb forward, iOS via iproxy, or externally managed). */
    public void connect(String vmServiceUrl) {
        connect(vmServiceUrl, 30_000);
    }

    public void connect(String vmServiceUrl, int timeoutMs) {
        try {
            connectWebSocket(toWsUri(vmServiceUrl));
            resolveIsolateAndDriverExtension(timeoutMs);
        } catch (URISyntaxException e) {
            throw new RuntimeException("Invalid VM service URL: " + vmServiceUrl, e);
        }
    }

    public void close() {
        failAllPending(new IllegalStateException("FlutterDesktopDriver closed"));
        if (ws != null) {
            ws.abort();
            ws = null;
        }
        isolateId = null;
        if (process != null) {
            process.destroy();
            try {
                if (!process.waitFor(2, TimeUnit.SECONDS)) {
                    process.destroyForcibly();
                }
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
            }
            process = null;
        }
    }

    // ---- public flutter_driver command API — 1:1 with the TS class ----

    public void tap(Finder finder) {
        tap(finder, null);
    }

    public void tap(Finder finder, Integer timeoutMs) {
        Map<String, Object> cmd = new HashMap<>(serializeFinder(finder));
        cmd.put("command", "tap");
        driverCommand(cmd, timeoutMs);
    }

    public void enterText(Finder finder, String text) {
        enterText(finder, text, null);
    }

    public void enterText(Finder finder, String text, Integer timeoutMs) {
        ensureTextEntryEmulation();
        tap(finder, timeoutMs);
        driverCommand(Map.of("command", "enter_text", "text", text), timeoutMs);
    }

    public String requestData(String message) {
        return requestData(message, null);
    }

    public String requestData(String message, Integer timeoutMs) {
        JsonNode result = driverCommand(Map.of("command", "request_data", "message", message), timeoutMs);
        return result.has("message") ? result.get("message").asText() : result.asText();
    }

    public String getText(Finder finder) {
        return getText(finder, null);
    }

    public String getText(Finder finder, Integer timeoutMs) {
        Map<String, Object> cmd = new HashMap<>(serializeFinder(finder));
        cmd.put("command", "get_text");
        return driverCommand(cmd, timeoutMs).get("text").asText();
    }

    public void waitFor(Finder finder) {
        waitFor(finder, null);
    }

    public void waitFor(Finder finder, Integer timeoutMs) {
        Map<String, Object> cmd = new HashMap<>(serializeFinder(finder));
        cmd.put("command", "waitFor");
        driverCommand(cmd, timeoutMs);
    }

    public void waitForAbsent(Finder finder) {
        waitForAbsent(finder, null);
    }

    public void waitForAbsent(Finder finder, Integer timeoutMs) {
        Map<String, Object> cmd = new HashMap<>(serializeFinder(finder));
        cmd.put("command", "waitForAbsent");
        driverCommand(cmd, timeoutMs);
    }

    /** Returns the path the PNG was written to, matching the TS driver (unlike JavaFxDriver, which returns bytes). */
    public String takeScreenshot(String name) {
        JsonNode result = driverCommand(Map.of("command", "screenshot"), null);
        byte[] png = Base64.getDecoder().decode(result.get("screenshot").asText());
        try {
            String dir = cfg.screenshotDir() != null ? cfg.screenshotDir() : "reports/screenshots";
            Path out = Paths.get(dir, name + ".png");
            Files.createDirectories(out.getParent());
            Files.write(out, png);
            return out.toString();
        } catch (IOException e) {
            throw new RuntimeException("Failed to write Flutter desktop screenshot", e);
        }
    }

    public void doubleTap(Finder finder) {
        doubleTap(finder, null);
    }

    public void doubleTap(Finder finder, Integer timeoutMs) {
        Map<String, Object> cmd = new HashMap<>(serializeFinder(finder));
        cmd.put("command", "double_tap");
        driverCommand(cmd, timeoutMs);
    }

    public void longPress(Finder finder) {
        longPress(finder, null);
    }

    public void longPress(Finder finder, Integer timeoutMs) {
        Map<String, Object> cmd = new HashMap<>(serializeFinder(finder));
        cmd.put("command", "long_press");
        driverCommand(cmd, timeoutMs);
    }

    public void scroll(Finder finder, double dx, double dy) {
        scroll(finder, dx, dy, 300, 60, null);
    }

    public void scroll(Finder finder, double dx, double dy, Integer durationMs, Integer frequency, Integer timeoutMs) {
        Map<String, Object> cmd = new HashMap<>(serializeFinder(finder));
        cmd.put("command", "scroll");
        cmd.put("dx", dx);
        cmd.put("dy", dy);
        cmd.put("duration", (durationMs != null ? durationMs : 300) * 1000L); // microseconds
        cmd.put("frequency", frequency != null ? frequency : 60);
        driverCommand(cmd, timeoutMs);
    }

    public void scrollIntoView(Finder finder) {
        scrollIntoView(finder, 0.0, null);
    }

    public void scrollIntoView(Finder finder, Double alignment, Integer timeoutMs) {
        Map<String, Object> cmd = new HashMap<>(serializeFinder(finder));
        cmd.put("command", "scrollIntoView");
        cmd.put("alignment", alignment != null ? alignment : 0.0);
        driverCommand(cmd, timeoutMs);
    }

    public void clearText(Finder finder) {
        clearText(finder, null);
    }

    public void clearText(Finder finder, Integer timeoutMs) {
        ensureTextEntryEmulation();
        tap(finder, timeoutMs);
        driverCommand(Map.of("command", "enter_text", "text", ""), timeoutMs);
    }

    public boolean isVisible(Finder finder) {
        return isVisible(finder, null);
    }

    public boolean isVisible(Finder finder, Integer timeoutMs) {
        try {
            waitFor(finder, timeoutMs != null ? timeoutMs : 2000);
            return true;
        } catch (RuntimeException e) {
            return false;
        }
    }

    public Offset getOffset(Finder finder) {
        return getOffset(finder, OffsetType.center, null);
    }

    public Offset getOffset(Finder finder, OffsetType offsetType, Integer timeoutMs) {
        Map<String, Object> cmd = new HashMap<>(serializeFinder(finder));
        cmd.put("command", "get_offset");
        cmd.put("offsetType", (offsetType != null ? offsetType : OffsetType.center).name());
        JsonNode result = driverCommand(cmd, timeoutMs);
        return new Offset(result.get("dx").asDouble(), result.get("dy").asDouble());
    }

    public void waitForCondition(WaitCondition condition) {
        waitForCondition(condition.name(), null);
    }

    public void waitForCondition(String conditionName) {
        waitForCondition(conditionName, null);
    }

    public void waitForCondition(String conditionName, Integer timeoutMs) {
        driverCommand(Map.of("command", "waitForCondition", "conditionName", conditionName), timeoutMs);
    }

    public void setFrameSync(boolean enabled) {
        setFrameSync(enabled, null);
    }

    public void setFrameSync(boolean enabled, Integer timeoutMs) {
        driverCommand(Map.of("command", "set_frame_sync", "enabled", String.valueOf(enabled)), timeoutMs);
    }

    // ---- internals ----

    private void ensureTextEntryEmulation() {
        // Must be enabled before the first tap() on macOS desktop, or the
        // TestTextInput mock path never establishes its connection — same
        // gotcha documented in the TS source.
        if (!textEntryEmulationEnabled) {
            driverCommand(Map.of("command", "set_text_entry_emulation", "enabled", "true"), null);
            textEntryEmulationEnabled = true;
        }
    }

    private Map<String, Object> serializeFinder(Finder finder) {
        return switch (finder.type()) {
            case ByValueKey -> Map.of("finderType", "ByValueKey", "keyValueString", finder.value(), "keyValueType", "String");
            case ByText -> Map.of("finderType", "ByText", "text", finder.value());
            case ByType -> Map.of("finderType", "ByType", "type", finder.value());
            case ByTooltipMessage -> Map.of("finderType", "ByTooltipMessage", "text", finder.value());
        };
    }

    private String waitForVmServiceUrl(Process proc, int timeoutMs) {
        CompletableFuture<String> found = new CompletableFuture<>();
        StringBuilder buffer = new StringBuilder();
        Thread reader = new Thread(() -> {
            try (BufferedReader r = new BufferedReader(new InputStreamReader(proc.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = r.readLine()) != null) {
                    buffer.append(line).append('\n');
                    Matcher m = VM_URL.matcher(buffer);
                    if (m.find()) {
                        found.complete(m.group(1));
                        return;
                    }
                }
            } catch (IOException ignored) {
                // stream closed
            }
        }, "flutter-desktop-stdout");
        reader.setDaemon(true);
        reader.start();

        proc.onExit().thenRun(() -> found.completeExceptionally(new RuntimeException(
                "Process exited (code=" + proc.exitValue() + ") before VM service URL appeared. Captured:\n" + buffer)));

        try {
            return found.get(timeoutMs, TimeUnit.MILLISECONDS);
        } catch (Exception e) {
            throw new RuntimeException("Timed out waiting for Dart VM service URL", e);
        }
    }

    private URI toWsUri(String vmUrl) throws URISyntaxException {
        URI httpUri = new URI(vmUrl);
        String scheme = "https".equals(httpUri.getScheme()) ? "wss" : "ws";
        String path = httpUri.getPath() == null || httpUri.getPath().isEmpty() ? "/"
                : httpUri.getPath().endsWith("/") ? httpUri.getPath() : httpUri.getPath() + "/";
        return new URI(scheme, httpUri.getAuthority(), path + "ws", null, null);
    }

    private void connectWebSocket(URI wsUri) {
        StringBuilder frameBuffer = new StringBuilder();
        try {
            ws = http.newWebSocketBuilder().buildAsync(wsUri, new WebSocket.Listener() {
                @Override
                public CompletionStage<?> onText(WebSocket webSocket, CharSequence data, boolean last) {
                    frameBuffer.append(data);
                    webSocket.request(1);
                    if (last) {
                        String message = frameBuffer.toString();
                        frameBuffer.setLength(0);
                        onMessage(message);
                    }
                    return null;
                }

                @Override
                public void onError(WebSocket webSocket, Throwable error) {
                    failAllPending(new RuntimeException("VM service WebSocket error", error));
                }

                @Override
                public CompletionStage<?> onClose(WebSocket webSocket, int statusCode, String reason) {
                    failAllPending(new RuntimeException("VM service WebSocket closed: " + reason));
                    return null;
                }
            }).get(10, TimeUnit.SECONDS);
        } catch (Exception e) {
            throw new RuntimeException("Failed to open VM service WebSocket at " + wsUri, e);
        }
    }

    private void onMessage(String raw) {
        JsonNode msg;
        try {
            msg = json.readTree(raw);
        } catch (Exception e) {
            return;
        }
        if (!msg.has("id") || !msg.get("id").isInt()) {
            return; // ignore events / notifications
        }
        CompletableFuture<JsonNode> future = pending.remove(msg.get("id").asInt());
        if (future == null) {
            return;
        }
        if (msg.has("error")) {
            JsonNode err = msg.get("error");
            future.completeExceptionally(new RuntimeException(
                    "VM service error (" + err.path("code").asInt() + "): " + err.path("message").asText()));
        } else {
            future.complete(msg.get("result"));
        }
    }

    private void failAllPending(Throwable t) {
        pending.forEach((id, f) -> f.completeExceptionally(t));
        pending.clear();
    }

    private JsonNode rpc(String method, Map<String, Object> params, int timeoutMs) {
        if (ws == null) {
            throw new IllegalStateException("VM service WebSocket is not open");
        }
        int id = nextRpcId.getAndIncrement();
        CompletableFuture<JsonNode> future = new CompletableFuture<>();
        pending.put(id, future);
        try {
            ObjectNode frame = json.createObjectNode();
            frame.put("jsonrpc", "2.0");
            frame.put("id", id);
            frame.put("method", method);
            frame.set("params", json.valueToTree(params));
            ws.sendText(frame.toString(), true);
            return future.orTimeout(timeoutMs, TimeUnit.MILLISECONDS).join();
        } catch (CompletionException e) {
            pending.remove(id);
            throw new RuntimeException("RPC " + method + " failed or timed out after " + timeoutMs + "ms",
                    e.getCause() != null ? e.getCause() : e);
        }
    }

    private JsonNode driverCommand(Map<String, Object> command, Integer timeoutMs) {
        if (isolateId == null) {
            throw new IllegalStateException("FlutterDesktopDriver not initialized. Call launch() or connect() first.");
        }
        Map<String, Object> params = new HashMap<>(command);
        params.put("isolateId", isolateId);
        int rpcTimeout = timeoutMs != null ? timeoutMs
                : cfg.defaultTimeoutMs() != null ? cfg.defaultTimeoutMs() : 10_000;
        JsonNode result = rpc("ext.flutter.driver", params, rpcTimeout);
        if (result.path("isError").asBoolean(false)) {
            throw new RuntimeException("flutter_driver command failed: " + result.path("response"));
        }
        return result.has("response") ? result.get("response") : result;
    }

    private void resolveIsolateAndDriverExtension(int timeoutMs) {
        long deadline = System.currentTimeMillis() + timeoutMs;
        while (System.currentTimeMillis() < deadline) {
            JsonNode vm = rpc("getVM", Map.of(), 5000);
            JsonNode isolates = vm.get("isolates");
            if (isolates != null) {
                for (JsonNode ref : isolates) {
                    String id = ref.get("id").asText();
                    JsonNode isolate = rpc("getIsolate", Map.of("isolateId", id), 5000);
                    JsonNode extensions = isolate.get("extensionRPCs");
                    if (extensions != null) {
                        for (JsonNode ext : extensions) {
                            if ("ext.flutter.driver".equals(ext.asText())) {
                                this.isolateId = id;
                                return;
                            }
                        }
                    }
                }
            }
            try {
                Thread.sleep(200);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new RuntimeException(e);
            }
        }
        throw new IllegalStateException("Timed out waiting for ext.flutter.driver extension to register");
    }
}
