package com.nouhouari.conductor.config;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.NullNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;

import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;

/**
 * Java port of config/index.ts's loadConfig(). Loading order (lowest to
 * highest precedence), a deliberate 3-layer scheme (vs. TS's 2-layer
 * default+TEST_ENV):
 *
 * <ol>
 *   <li>{@code config/default.yml} on the classpath — conductor-core's generic
 *       library defaults. desktop/flutterDesktop are intentionally absent here
 *       (a reusable library shouldn't hardcode one monorepo's app paths).</li>
 *   <li>{@code config/local-overrides.yml} on the classpath, if present — a
 *       consuming project's own defaults (e.g. conductor-example supplies
 *       repo-relative desktop.agentJar / flutterDesktop.appPath here via Maven
 *       resource filtering). This replaces TS's {@code __dirname}-relative path
 *       baking, which has no Java equivalent.</li>
 *   <li>{@code config/${TEST_ENV}.yml} on the classpath, if {@code TEST_ENV} is
 *       set to something other than {@code "default"} — mirrors config/environments/*.ts
 *       overlays (dev/staging). Silently skipped if missing, matching the TS
 *       try/catch fallback.</li>
 * </ol>
 *
 * <p>After all overlays are merged, the same fixed table of individual
 * environment-variable overrides from config/index.ts is applied, in the same
 * order, at the highest precedence.
 *
 * <p>Object values merge recursively (deep merge); arrays and scalars are
 * replaced wholesale by the override — identical semantics to TS's deepMerge.
 */
public final class ConfigLoader {

    private static final ObjectMapper YAML = new ObjectMapper(new YAMLFactory());
    private static volatile EnvironmentConfig instance;

    private ConfigLoader() {
    }

    /** Computed once and cached, mirroring the TS module-level singleton `config`. */
    public static EnvironmentConfig get() {
        EnvironmentConfig result = instance;
        if (result == null) {
            synchronized (ConfigLoader.class) {
                result = instance;
                if (result == null) {
                    instance = result = load();
                }
            }
        }
        return result;
    }

    /** Re-runs the loader (mostly useful for tests). Does not affect {@link #get()}'s cache. */
    public static EnvironmentConfig load() {
        JsonNode base = readRequiredClasspathYaml("/config/default.yml");

        JsonNode localOverrides = readOptionalClasspathYaml("/config/local-overrides.yml");
        if (localOverrides != null) {
            base = deepMerge(base, localOverrides);
        }

        String env = firstNonBlank(System.getProperty("TEST_ENV"), System.getenv("TEST_ENV"));
        if (env != null && !"default".equals(env)) {
            JsonNode overlay = readOptionalClasspathYaml("/config/" + env + ".yml");
            if (overlay != null) {
                base = deepMerge(base, overlay);
            }
        }

        ObjectNode root = (ObjectNode) base;
        applyEnvOverrides(root);

        try {
            return YAML.treeToValue(root, EnvironmentConfig.class);
        } catch (IOException e) {
            throw new IllegalStateException("Invalid conductor configuration", e);
        }
    }

    private static JsonNode deepMerge(JsonNode base, JsonNode override) {
        if (base.isObject() && override.isObject()) {
            ObjectNode merged = base.deepCopy();
            override.fields().forEachRemaining(entry -> merged.set(
                    entry.getKey(),
                    deepMerge(merged.has(entry.getKey()) ? merged.get(entry.getKey()) : NullNode.getInstance(),
                            entry.getValue())));
            return merged;
        }
        return override;
    }

    private static void applyEnvOverrides(ObjectNode root) {
        putStr(at(root, "web"), "baseUrl", System.getenv("WEB_BASE_URL"));
        putStr(at(root, "api"), "baseUrl", System.getenv("API_BASE_URL"));

        String headless = System.getenv("HEADLESS");
        if (headless != null) {
            at(root, "web").put("headless", !"false".equals(headless));
        }
        putStr(at(root, "web"), "browserName", System.getenv("BROWSER"));
        putStr(at(root, "mobile"), "deviceId", System.getenv("MAESTRO_DEVICE"));

        if (root.has("flutterDesktop") && !root.get("flutterDesktop").isNull()) {
            ObjectNode fd = at(root, "flutterDesktop");
            putStr(fd, "appPath", System.getenv("FLUTTER_DESKTOP_APP_PATH"));
            String vmPort = System.getenv("FLUTTER_DESKTOP_VM_PORT");
            if (vmPort != null) {
                fd.put("vmServicePort", Integer.parseInt(vmPort));
            }
        }

        if (root.has("remoteScenarios") && !root.get("remoteScenarios").isNull()) {
            ObjectNode rs = at(root, "remoteScenarios");
            putStr(rs, "baseUrl", System.getenv("REMOTE_SCENARIOS_URL"));
            putStr(rs, "project", System.getenv("REMOTE_SCENARIOS_PROJECT"));
            putStr(rs, "outputDir", System.getenv("REMOTE_SCENARIOS_OUTPUT_DIR"));

            ObjectNode filters = at(rs, "filters");
            putStr(filters, "story", System.getenv("REMOTE_SCENARIOS_STORY"));
            putStr(filters, "requirement", System.getenv("REMOTE_SCENARIOS_REQUIREMENT"));
            putStr(filters, "phase", System.getenv("REMOTE_SCENARIOS_PHASE"));
            putStr(filters, "mode", System.getenv("REMOTE_SCENARIOS_MODE"));
            putStr(filters, "tags", System.getenv("REMOTE_SCENARIOS_TAGS"));
            putStr(filters, "feature", System.getenv("REMOTE_SCENARIOS_FEATURE"));
            putStr(filters, "q", System.getenv("REMOTE_SCENARIOS_Q"));
            String valid = System.getenv("REMOTE_SCENARIOS_VALID");
            if (valid != null) {
                filters.put("valid", "true".equals(valid));
            }
        }
    }

    private static ObjectNode at(ObjectNode parent, String field) {
        JsonNode existing = parent.get(field);
        if (existing instanceof ObjectNode objectNode) {
            return objectNode;
        }
        ObjectNode created = YAML.createObjectNode();
        parent.set(field, created);
        return created;
    }

    private static void putStr(ObjectNode node, String field, String value) {
        if (value != null) {
            node.put(field, value);
        }
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v;
            }
        }
        return null;
    }

    private static JsonNode readRequiredClasspathYaml(String resourcePath) {
        JsonNode node = readOptionalClasspathYaml(resourcePath);
        if (node == null) {
            throw new IllegalStateException("Missing required classpath resource: " + resourcePath);
        }
        return node;
    }

    private static JsonNode readOptionalClasspathYaml(String resourcePath) {
        try (InputStream in = ConfigLoader.class.getResourceAsStream(resourcePath)) {
            if (in == null) {
                return null;
            }
            return YAML.readTree(in);
        } catch (IOException e) {
            throw new UncheckedIOException("Failed to read " + resourcePath, e);
        }
    }
}
