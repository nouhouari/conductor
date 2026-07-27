package com.nouhouari.conductor.drivers;

import com.nouhouari.conductor.config.DesktopConfig;
import com.nouhouari.conductor.drivers.internal.FxAgentClient;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Drives a JavaFX desktop app instrumented with {@code fxagent.jar} (started
 * via {@code -javaagent:}), talking directly to its HTTP/JSON REST protocol
 * via {@link FxAgentClient}. Public API shape (launch options, locator
 * ergonomics) matches the actual usage found in
 * example/step-definitions/desktop.steps.ts, which this replaces the npm
 * {@code javafx-driver} package for.
 */
public class JavaFxDriver {

    public record LaunchOptions(String app, String classpath, List<String> jvmArgs, Integer readyTimeoutMs) {
    }

    public record WaitOptions(String state, Integer timeoutMs) {
    }

    private final DesktopConfig config;
    private final FxAgentClient client;
    private Process process;
    private volatile boolean launched = false;

    public JavaFxDriver(DesktopConfig config) {
        this.config = config;
        this.client = new FxAgentClient(
                config.agentHost() != null ? config.agentHost() : FxAgentClient.DEFAULT_HOST,
                config.agentPort() != null ? config.agentPort() : FxAgentClient.DEFAULT_PORT);
    }

    public boolean isLaunched() {
        return launched;
    }

    public void launch(LaunchOptions opts) {
        List<String> cmd = new ArrayList<>();
        cmd.add(config.javaBin() != null ? config.javaBin() : "java");
        if (config.jvmArgs() != null) {
            cmd.addAll(config.jvmArgs());
        }
        cmd.add("-javaagent:" + config.agentJar());
        if (opts.jvmArgs() != null) {
            cmd.addAll(opts.jvmArgs());
        }
        cmd.add("-cp");
        cmd.add(opts.classpath());
        cmd.add(opts.app());

        int timeoutMs = opts.readyTimeoutMs() != null ? opts.readyTimeoutMs()
                : config.defaultTimeoutMs() != null ? config.defaultTimeoutMs() : 10_000;
        int pollIntervalMs = config.pollIntervalMs() != null ? config.pollIntervalMs() : 200;

        try {
            process = new ProcessBuilder(cmd).redirectErrorStream(true).start();
            pumpToDiscard(process);
            pollUntilReady(timeoutMs, pollIntervalMs);
            launched = true;
        } catch (IOException e) {
            throw new RuntimeException("Failed to launch JavaFX app under fxagent", e);
        }
    }

    private void pollUntilReady(int timeoutMs, int pollIntervalMs) {
        long deadline = System.currentTimeMillis() + timeoutMs;
        RuntimeException lastError = null;
        while (System.currentTimeMillis() < deadline) {
            if (!process.isAlive()) {
                throw new IllegalStateException("JavaFX app process exited before fxagent became ready (exit=" + process.exitValue() + ")");
            }
            try {
                if (client.isReady()) {
                    return;
                }
            } catch (RuntimeException e) {
                lastError = e;
            }
            try {
                Thread.sleep(pollIntervalMs);
            } catch (InterruptedException ie) {
                Thread.currentThread().interrupt();
                throw new RuntimeException(ie);
            }
        }
        throw new IllegalStateException("Timed out waiting for fxagent to become ready after " + timeoutMs + "ms", lastError);
    }

    public Locator locator(String selector) {
        return new Locator(selector);
    }

    public byte[] screenshot(String name) {
        FxAgentClient.ScreenshotResponse response = client.captureScreenshot(null, null);
        byte[] png = FxAgentClient.decodePng(response);
        try {
            String dir = config.screenshotDir() != null ? config.screenshotDir() : "reports/screenshots";
            Path out = Paths.get(dir, name + ".png");
            Files.createDirectories(out.getParent());
            Files.write(out, png);
        } catch (IOException e) {
            throw new RuntimeException("Failed to write desktop screenshot", e);
        }
        return png;
    }

    public void close() {
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
        launched = false;
    }

    private static void pumpToDiscard(Process process) {
        Thread thread = new Thread(() -> {
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                while (reader.readLine() != null) {
                    // discarded — surface via this.logger at the step-def layer if ever needed
                }
            } catch (IOException ignored) {
            }
        }, "javafx-app-stdout");
        thread.setDaemon(true);
        thread.start();
    }

    public class Locator {
        private final String selector;

        Locator(String selector) {
            this.selector = selector;
        }

        public void click() {
            client.performAction(selector, "click", null);
        }

        public void fill(String value) {
            client.performAction(selector, "fill", value);
        }

        public void selectOption(String value) {
            client.performAction(selector, "selectOption", value);
        }

        public void setText(String value) {
            client.performAction(selector, "setText", value);
        }

        public void waitFor(WaitOptions opts) {
            String condition = "hidden".equals(opts.state()) ? "hidden" : "visible";
            int timeout = opts.timeoutMs() != null ? opts.timeoutMs()
                    : config.defaultTimeoutMs() != null ? config.defaultTimeoutMs() : 10_000;
            client.waitForElement(selector, condition, timeout);
        }
    }
}
