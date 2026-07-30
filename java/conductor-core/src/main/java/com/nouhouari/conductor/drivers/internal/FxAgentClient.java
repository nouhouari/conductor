package com.nouhouari.conductor.drivers.internal;

import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Plain HTTP/JSON client for the {@code fxagent.jar} Java agent that
 * instruments JavaFX apps under test (started via {@code -javaagent:fxagent.jar}).
 *
 * <p>The wire protocol was reverse-engineered from this repo's own
 * {@code mcp/src/tools/desktop/fxagent-client.ts} (an MCP tool that talks to
 * the same agent) rather than fxagent's source, which isn't vendored in this
 * repo. It's a plain REST/JSON API on {@code 127.0.0.1:4567} by default, so
 * porting it needed no reverse-engineering of the npm {@code javafx-driver}
 * package that the TypeScript side wraps.
 */
public class FxAgentClient {

    public static final String DEFAULT_HOST = "127.0.0.1";
    public static final int DEFAULT_PORT = 4567;
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(10);

    public record ElementNode(String handle, String id, String type, String fullType, boolean visible,
            boolean enabled) {
    }

    public record QueryResponse(java.util.List<ElementNode> elements) {
    }

    public record ActionResponse(boolean success, String message) {
    }

    public record ScreenshotResponse(String data, String format, int width, int height) {
    }

    public static class ConnectionException extends RuntimeException {
        public ConnectionException(String host, int port, Throwable cause) {
            super("Cannot connect to fxagent at " + host + ":" + port
                    + " — is the app running with -javaagent:fxagent.jar?", cause);
        }
    }

    public static class ProtocolException extends RuntimeException {
        public ProtocolException(int status, String endpoint, String detail) {
            super("fxagent returned HTTP " + status + " for " + endpoint + (detail != null ? ": " + detail : ""));
        }
    }

    private final String baseUrl;
    private final String host;
    private final int port;
    private final HttpClient http = HttpClient.newHttpClient();
    private final ObjectMapper json = new ObjectMapper()
            .disable(com.fasterxml.jackson.databind.DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES);

    public FxAgentClient() {
        this(DEFAULT_HOST, DEFAULT_PORT);
    }

    public FxAgentClient(String host, int port) {
        this.host = host;
        this.port = port;
        this.baseUrl = "http://" + host + ":" + port;
    }

    public boolean isReady() {
        try {
            request("GET", "/api/v1/scene/tree?depth=0", null);
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public ActionResponse performAction(String selector, String action, String value) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("selector", selector);
        body.put("action", action);
        if (value != null) {
            body.put("value", value);
        }
        return post("/api/v1/actions", body, ActionResponse.class);
    }

    public ElementNode waitForElement(String selector, String condition, int timeoutMs) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("selector", selector);
        body.put("condition", condition);
        body.put("timeoutMs", timeoutMs);
        body.put("pollIntervalMs", 200);
        return post("/api/v1/elements/wait", body, ElementNode.class);
    }

    /**
     * Single-element query used for client-side wait polling — the agent's own
     * {@code /elements/wait} cannot express "hidden"/"absent" (it fails when no
     * element matches), so waits are polled here exactly as the npm
     * {@code javafx-driver} does.
     */
    public QueryResponse queryNode(String selector) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("selector", selector);
        body.put("maxResults", 1);
        return post("/api/v1/elements/query", body, QueryResponse.class);
    }

    public ScreenshotResponse captureScreenshot(String selector, Integer windowIndex) {
        Map<String, Object> body = new LinkedHashMap<>();
        if (selector != null) {
            body.put("selector", selector);
        }
        if (windowIndex != null) {
            body.put("windowIndex", windowIndex);
        }
        return post("/api/v1/screenshot", body, ScreenshotResponse.class);
    }

    public static byte[] decodePng(ScreenshotResponse response) {
        return Base64.getDecoder().decode(response.data());
    }

    private <T> T post(String path, Object body, Class<T> type) {
        return request("POST", path, body, type);
    }

    private <T> T request(String method, String path, Object body, Class<T> type) {
        String raw = request(method, path, body);
        try {
            return json.readValue(raw, type);
        } catch (IOException e) {
            throw new RuntimeException("Failed to parse fxagent response for " + path, e);
        }
    }

    private String request(String method, String path, Object body) {
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder()
                    .uri(URI.create(baseUrl + path))
                    .timeout(REQUEST_TIMEOUT);

            if (body != null) {
                String payload = json.writeValueAsString(body);
                builder.header("Content-Type", "application/json")
                        .method(method, HttpRequest.BodyPublishers.ofString(payload));
            } else {
                builder.method(method, HttpRequest.BodyPublishers.noBody());
            }

            HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() >= 400) {
                throw new ProtocolException(response.statusCode(), path, response.body());
            }
            return response.body();
        } catch (java.net.ConnectException e) {
            throw new ConnectionException(host, port, e);
        } catch (IOException e) {
            throw new RuntimeException("fxagent request failed: " + method + " " + path, e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new RuntimeException("fxagent request interrupted: " + method + " " + path, e);
        }
    }
}
