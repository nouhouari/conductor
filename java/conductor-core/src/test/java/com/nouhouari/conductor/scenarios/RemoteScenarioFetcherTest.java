package com.nouhouari.conductor.scenarios;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.nouhouari.conductor.config.RemoteScenariosConfig;
import com.nouhouari.conductor.config.RemoteScenariosFilters;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Verifies the Java RemoteScenarioFetcher reproduces the behaviour of
 * src/scenarios/RemoteScenarioFetcher.ts: query construction, error surfacing,
 * feature-level tag recovery, background handling, filename slugging and
 * collision suffixing.
 */
class RemoteScenarioFetcherTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private HttpServer server;
    private String baseUrl;
    private final AtomicReference<String> lastQuery = new AtomicReference<>();

    @BeforeEach
    void startServer() throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        baseUrl = "http://127.0.0.1:" + server.getAddress().getPort() + "/api";
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    private void respond(int status, String body) {
        server.createContext("/api/scenarios", exchange -> {
            // Raw (still percent-encoded) query — getQuery() would decode it.
            lastQuery.set(exchange.getRequestURI().getRawQuery());
            byte[] out = body.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, out.length);
            exchange.getResponseBody().write(out);
            exchange.close();
        });
    }

    private static String json(Object value) {
        try {
            return MAPPER.writeValueAsString(value);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private RemoteScenariosConfig config(RemoteScenariosFilters filters, String outputDir) {
        return new RemoteScenariosConfig(baseUrl, "demo", filters, outputDir);
    }

    @Test
    void sendsContentTrueAndAllFilterParams() {
        respond(200, json(Map.of("total", 0, "scenarios", List.of())));

        var filters = new RemoteScenariosFilters("US-007", "REQ-001", "P1", "strict",
                "@smoke and not @wip", "Todo CRUD", "search me", true);
        RemoteScenarioFetcher.fetchScenarios(config(filters, "unused"));

        String q = lastQuery.get();
        assertThat(q).contains("content=true");
        assertThat(q).contains("project=demo");
        assertThat(q).contains("story=US-007");
        assertThat(q).contains("requirement=REQ-001");
        assertThat(q).contains("phase=P1");
        assertThat(q).contains("mode=strict");
        assertThat(q).contains("feature=Todo+CRUD");
        assertThat(q).contains("valid=true");
        // tag expression and free-text must be URL-encoded
        assertThat(q).contains("tags=%40smoke+and+not+%40wip");
        assertThat(q).contains("q=search+me");
    }

    @Test
    void omitsUnsetFilters() {
        respond(200, json(Map.of("total", 0, "scenarios", List.of())));

        RemoteScenarioFetcher.fetchScenarios(new RemoteScenariosConfig(baseUrl, null, null, "unused"));

        assertThat(lastQuery.get()).isEqualTo("content=true");
    }

    @Test
    void surfacesApiErrorDetailAndAvailableProjects() {
        respond(404, json(Map.of("error", "unknown project", "available", List.of("alpha", "beta"))));

        assertThatThrownBy(() -> RemoteScenarioFetcher.fetchScenarios(config(null, "unused")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("returned 404")
                .hasMessageContaining("unknown project")
                .hasMessageContaining("available projects: alpha, beta");
    }

    @Test
    void wrapsConnectionFailureWithUrl() {
        var unreachable = new RemoteScenariosConfig("http://127.0.0.1:1/api", null, null, "unused");

        assertThatThrownBy(() -> RemoteScenarioFetcher.fetchScenarios(unreachable))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Failed to reach requ scenario API")
                .hasMessageContaining("http://127.0.0.1:1/api/scenarios");
    }

    @Test
    void stripsTrailingSlashesFromBaseUrl() {
        respond(200, json(Map.of("total", 0, "scenarios", List.of())));

        var cfg = new RemoteScenariosConfig(baseUrl + "///", null, null, "unused");
        // Would hit a doubled-slash path and 404 if not normalised.
        assertThat(RemoteScenarioFetcher.fetchScenarios(cfg)).isEmpty();
    }

    @Test
    void recoversFeatureLevelTagsAndWritesBackgroundOnce(@TempDir Path tmp) throws IOException {
        // @web is on every scenario's `tags` but never on its own content tag
        // lines -> it is a feature-level tag. @crud appears inline on one
        // scenario only -> stays scenario-level.
        var a = summary("Todo CRUD", "Create", List.of("@web", "@crud"),
                "@crud\nScenario: Create\n  Given a thing", "Background:\n  Given setup");
        var b = summary("Todo CRUD", "Delete", List.of("@web"),
                "Scenario: Delete\n  Given another thing", "Background:\n  Given setup");

        var result = RemoteScenarioFetcher.reconstructFeatureFiles(List.of(a, b), tmp.resolve("out").toString());

        assertThat(result.features()).isEqualTo(1);
        assertThat(result.scenarios()).isEqualTo(2);

        Path file = Path.of(result.dir(), "todo-crud.feature");
        String body = Files.readString(file);

        assertThat(body).startsWith("@web\nFeature: Todo CRUD\n");
        // Background emitted exactly once, before the scenarios
        assertThat(body.split("Background:", -1)).hasSize(2);
        assertThat(body.indexOf("Background:")).isLessThan(body.indexOf("Scenario: Create"));
        assertThat(body).contains("@crud\nScenario: Create");
        assertThat(body).contains("Scenario: Delete");
        assertThat(body).endsWith("\n");
        assertThat(body).doesNotContain("\n\n\n");
    }

    @Test
    void emitsNoFeatureTagLineWhenNoTagsAreCommon(@TempDir Path tmp) throws IOException {
        var a = summary("Mixed", "One", List.of("@web"), "Scenario: One\n  Given x", "");
        var b = summary("Mixed", "Two", List.of("@api"), "Scenario: Two\n  Given y", "");

        var result = RemoteScenarioFetcher.reconstructFeatureFiles(List.of(a, b), tmp.resolve("out").toString());

        String body = Files.readString(Path.of(result.dir(), "mixed.feature"));
        assertThat(body).startsWith("Feature: Mixed\n");
    }

    @Test
    void skipsScenariosWithoutContentAndFeaturesLeftEmpty(@TempDir Path tmp) {
        var empty = summary("Ghost", "None", List.of("@web"), "   ", "Background:\n  Given setup");
        var real = summary("Real", "One", List.of("@web"), "Scenario: One\n  Given x", "");

        var result = RemoteScenarioFetcher.reconstructFeatureFiles(List.of(empty, real), tmp.resolve("out").toString());

        assertThat(result.features()).isEqualTo(1);
        assertThat(result.scenarios()).isEqualTo(1);
        assertThat(Path.of(result.dir(), "ghost.feature")).doesNotExist();
        assertThat(Path.of(result.dir(), "real.feature")).exists();
    }

    @Test
    void suffixesCollidingFileNames(@TempDir Path tmp) {
        // Both slug to "todo-crud"
        var a = summary("Todo CRUD", "One", List.of(), "Scenario: One\n  Given x", "");
        var b = summary("todo!!!crud", "Two", List.of(), "Scenario: Two\n  Given y", "");

        var result = RemoteScenarioFetcher.reconstructFeatureFiles(List.of(a, b), tmp.resolve("out").toString());

        assertThat(result.features()).isEqualTo(2);
        assertThat(Path.of(result.dir(), "todo-crud.feature")).exists();
        assertThat(Path.of(result.dir(), "todo-crud-2.feature")).exists();
    }

    @Test
    void cleansOutputDirectoryBeforeWriting(@TempDir Path tmp) throws IOException {
        Path out = tmp.resolve("out");
        Files.createDirectories(out);
        Path stale = out.resolve("stale.feature");
        Files.writeString(stale, "@old\nFeature: Stale\n");

        var sc = summary("Fresh", "One", List.of(), "Scenario: One\n  Given x", "");
        RemoteScenarioFetcher.reconstructFeatureFiles(List.of(sc), out.toString());

        assertThat(stale).doesNotExist();
        assertThat(out.resolve("fresh.feature")).exists();
    }

    @Test
    void slugsFeatureNamesSafely() {
        assertThat(RemoteScenarioFetcher.featureFileName("Todo CRUD")).isEqualTo("todo-crud.feature");
        assertThat(RemoteScenarioFetcher.featureFileName("  Weird!!Name??  ")).isEqualTo("weird-name.feature");
        assertThat(RemoteScenarioFetcher.featureFileName("***")).isEqualTo("feature.feature");
    }

    @Test
    void readsOnlyLeadingTagLines() {
        String content = "@a @b\n@c\nScenario: x\n  Given y\n@not-a-leading-tag";
        assertThat(RemoteScenarioFetcher.leadingContentTags(content))
                .containsExactlyInAnyOrder("@a", "@b", "@c");
    }

    private static RemoteScenarioSummary summary(String feature, String name, List<String> tags,
                                                 String content, String background) {
        return new RemoteScenarioSummary(feature + "::" + name, feature, name, tags,
                null, null, true, true, !background.isBlank(), "pending", content, background);
    }
}
