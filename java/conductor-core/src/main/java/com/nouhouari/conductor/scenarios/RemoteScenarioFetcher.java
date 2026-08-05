package com.nouhouari.conductor.scenarios;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nouhouari.conductor.config.RemoteScenariosConfig;
import com.nouhouari.conductor.config.RemoteScenariosFilters;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.StringJoiner;
import java.util.stream.Collectors;

/**
 * Sources cucumber scenarios from the requ scenario API and reconstructs them
 * into {@code .feature} files on disk so Cucumber (which only reads filesystem
 * globs) can run them — without touching the local {@code features/} folder.
 *
 * <p>Java port of {@code src/scenarios/RemoteScenarioFetcher.ts}. See the requ
 * OpenAPI spec: {@code GET /api/scenarios} returns scenario summaries; with
 * {@code content=true} each carries the raw gherkin of one Scenario block plus
 * the feature's Background.
 */
public final class RemoteScenarioFetcher {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private RemoteScenarioFetcher() {
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record ScenarioListResponse(int total, List<RemoteScenarioSummary> scenarios) {
    }

    /** Result of reconstructing feature files on disk. */
    public record ReconstructResult(int features, int scenarios, String dir) {
    }

    /**
     * Fetch scenarios from the requ scenario API, applying server-side filters.
     * Always requests {@code content=true} so the gherkin body and background
     * come inline.
     */
    public static List<RemoteScenarioSummary> fetchScenarios(RemoteScenariosConfig config) {
        String base = config.baseUrl().replaceAll("/+$", "");

        StringJoiner params = new StringJoiner("&");
        params.add(param("content", "true"));
        if (notBlank(config.project())) {
            params.add(param("project", config.project()));
        }

        RemoteScenariosFilters f = config.filters();
        if (f != null) {
            if (notBlank(f.story())) params.add(param("story", f.story()));
            if (notBlank(f.requirement())) params.add(param("requirement", f.requirement()));
            if (notBlank(f.phase())) params.add(param("phase", f.phase()));
            if (notBlank(f.mode())) params.add(param("mode", f.mode()));
            if (notBlank(f.tags())) params.add(param("tags", f.tags()));
            if (notBlank(f.feature())) params.add(param("feature", f.feature()));
            if (notBlank(f.q())) params.add(param("q", f.q()));
            if (f.valid() != null) params.add(param("valid", String.valueOf(f.valid())));
        }

        String url = base + "/scenarios?" + params;

        HttpResponse<String> res;
        try {
            HttpClient client = HttpClient.newHttpClient();
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .header("Accept", "application/json")
                    .GET()
                    .build();
            res = client.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Failed to reach requ scenario API at " + url + ": " + e.getMessage(), e);
        } catch (IOException | RuntimeException e) {
            throw new IllegalStateException("Failed to reach requ scenario API at " + url + ": " + e.getMessage(), e);
        }

        if (res.statusCode() < 200 || res.statusCode() >= 300) {
            String detail = errorDetail(res.body());
            throw new IllegalStateException("requ scenario API returned " + res.statusCode() + " for " + url
                    + (detail.isEmpty() ? "" : ": " + detail));
        }

        try {
            ScenarioListResponse data = MAPPER.readValue(res.body(), ScenarioListResponse.class);
            return data.scenarios() != null ? data.scenarios() : List.of();
        } catch (IOException e) {
            throw new IllegalStateException("requ scenario API returned an unreadable body for " + url + ": " + e.getMessage(), e);
        }
    }

    /** Mirrors the TS branch that pulls {@code error} / {@code available} out of a JSON error body. */
    private static String errorDetail(String body) {
        if (body == null || body.isBlank()) {
            return "";
        }
        try {
            JsonNode node = MAPPER.readTree(body);
            StringBuilder detail = new StringBuilder();
            if (node.hasNonNull("error")) {
                detail.append(node.get("error").asText());
            }
            JsonNode available = node.get("available");
            if (available != null && available.isArray()) {
                List<String> names = new ArrayList<>();
                available.forEach(n -> names.add(n.asText()));
                detail.append(" (available projects: ").append(String.join(", ", names)).append(")");
            }
            return detail.toString();
        } catch (IOException e) {
            return ""; // non-JSON error body; ignore
        }
    }

    /**
     * Reconstruct {@code .feature} files from API scenario summaries, grouped by
     * feature. Writes one file per feature into {@code outputDir} (which is
     * cleaned first).
     *
     * <p>Feature-level tags (e.g. {@code @web}) are recovered as the tags common
     * to every scenario in a feature that do NOT appear on that scenario's own
     * content tag lines, then emitted above {@code Feature:} so local
     * {@code --tags}/profiles still match.
     */
    public static ReconstructResult reconstructFeatureFiles(List<RemoteScenarioSummary> scenarios, String outputDir) {
        Path dir = Paths.get(outputDir).toAbsolutePath().normalize();
        try {
            deleteRecursively(dir);
            Files.createDirectories(dir);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to prepare output directory " + dir, e);
        }

        // Group by feature name, preserving first-seen order.
        Map<String, List<RemoteScenarioSummary>> groups = new LinkedHashMap<>();
        for (RemoteScenarioSummary sc : scenarios) {
            groups.computeIfAbsent(sc.feature(), k -> new ArrayList<>()).add(sc);
        }

        Set<String> usedNames = new HashSet<>();
        int featuresWritten = 0;
        int scenariosWritten = 0;

        for (Map.Entry<String, List<RemoteScenarioSummary>> entry : groups.entrySet()) {
            String feature = entry.getKey();

            // Only content-bearing scenarios contribute to the file and to tag recovery.
            // A feature with a Background but no scenarios is invalid Gherkin, so skip it.
            List<RemoteScenarioSummary> withContent = entry.getValue().stream()
                    .filter(sc -> !sc.contentOrEmpty().trim().isEmpty())
                    .collect(Collectors.toList());
            if (withContent.isEmpty()) {
                continue;
            }

            // Feature-level tags = present on every scenario, absent from each one's own tag lines.
            Set<String> featureTags = null;
            for (RemoteScenarioSummary sc : withContent) {
                Set<String> own = leadingContentTags(sc.contentOrEmpty());
                Set<String> inherited = sc.tagsOrEmpty().stream()
                        .filter(t -> !own.contains(t))
                        .collect(Collectors.toCollection(LinkedHashSet::new));
                if (featureTags == null) {
                    featureTags = inherited;
                } else {
                    featureTags.retainAll(inherited);
                }
            }
            // Sorted for deterministic, diff-stable output (tag order is insignificant to cucumber).
            List<String> tags = featureTags == null ? List.of()
                    : featureTags.stream().sorted(Comparator.naturalOrder()).collect(Collectors.toList());

            String background = withContent.stream()
                    .map(RemoteScenarioSummary::backgroundOrEmpty)
                    .filter(b -> !b.trim().isEmpty())
                    .map(String::trim)
                    .findFirst()
                    .orElse(null);

            List<String> lines = new ArrayList<>();
            if (!tags.isEmpty()) {
                lines.add(String.join(" ", tags));
            }
            lines.add("Feature: " + feature);
            lines.add("");
            if (background != null) {
                lines.add(background);
                lines.add("");
            }
            for (RemoteScenarioSummary sc : withContent) {
                lines.add(stripTrailingWhitespace(sc.contentOrEmpty()));
                lines.add("");
                scenariosWritten++;
            }

            String name = featureFileName(feature);
            if (usedNames.contains(name)) {
                String stem = name.replaceAll("\\.feature$", "");
                int i = 2;
                while (usedNames.contains(stem + "-" + i + ".feature")) {
                    i++;
                }
                name = stem + "-" + i + ".feature";
            }
            usedNames.add(name);

            String body = String.join("\n", lines).replaceAll("\n+$", "") + "\n";
            try {
                Files.writeString(dir.resolve(name), body, StandardCharsets.UTF_8);
            } catch (IOException e) {
                throw new UncheckedIOException("Failed to write feature file " + name, e);
            }
            featuresWritten++;
        }

        return new ReconstructResult(featuresWritten, scenariosWritten, dir.toString());
    }

    /** Tag tokens on the leading tag lines of a scenario's content block. */
    static Set<String> leadingContentTags(String content) {
        Set<String> tags = new LinkedHashSet<>();
        for (String raw : content.split("\r?\n")) {
            String line = raw.trim();
            if (line.isEmpty()) {
                continue;
            }
            if (line.startsWith("@")) {
                for (String t : line.split("\\s+")) {
                    if (t.startsWith("@")) {
                        tags.add(t);
                    }
                }
                continue;
            }
            break; // first non-tag, non-blank line ends the leading tag block
        }
        return tags;
    }

    /** Slugify a feature name into a safe {@code .feature} filename. */
    static String featureFileName(String feature) {
        String slug = feature.trim()
                .toLowerCase()
                .replaceAll("[^a-z0-9]+", "-")
                .replaceAll("^-+|-+$", "");
        return (slug.isEmpty() ? "feature" : slug) + ".feature";
    }

    private static String stripTrailingWhitespace(String s) {
        return s.replaceAll("\\s+$", "");
    }

    private static void deleteRecursively(Path path) throws IOException {
        if (!Files.exists(path)) {
            return;
        }
        try (var walk = Files.walk(path)) {
            List<Path> entries = walk.sorted(Comparator.reverseOrder()).collect(Collectors.toList());
            for (Path p : entries) {
                Files.deleteIfExists(p);
            }
        }
    }

    private static String param(String key, String value) {
        return URLEncoder.encode(key, StandardCharsets.UTF_8) + "=" + URLEncoder.encode(value, StandardCharsets.UTF_8);
    }

    private static boolean notBlank(String s) {
        return s != null && !s.isBlank();
    }
}
