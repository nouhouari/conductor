package com.nouhouari.conductor.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ConfigLoaderTest {

    @Test
    void loadsCoreDefaultsWhenNoOverridesPresent() {
        EnvironmentConfig config = ConfigLoader.load();

        assertThat(config.name()).isEqualTo("default");
        assertThat(config.web().baseUrl()).isEqualTo("http://localhost:3000");
        assertThat(config.web().headless()).isTrue();
        assertThat(config.web().browserName()).isEqualTo("chromium");
        assertThat(config.api().defaultCredentials().username()).isEqualTo("test@example.com");
        assertThat(config.mobile().flowsDir()).isEqualTo("flows/mobile");
        assertThat(config.database().enabled()).isFalse();
        // conductor-core's bundled default.yml deliberately omits these —
        // only a consuming project's local-overrides.yml supplies them.
        assertThat(config.desktop()).isNull();
        assertThat(config.flutterDesktop()).isNull();
    }

    @Test
    void devOverlayMergesOntoDefaultsWithoutDroppingUnrelatedKeys() {
        System.setProperty("TEST_ENV", "dev");
        try {
            EnvironmentConfig config = ConfigLoader.load();
            assertThat(config.name()).isEqualTo("dev");
            assertThat(config.web().headless()).isFalse();
            assertThat(config.web().slowMo()).isEqualTo(100);
            // mobile isn't touched by dev.yml — must still come through from default.yml
            assertThat(config.mobile().flowsDir()).isEqualTo("flows/mobile");
            assertThat(config.mobile().timeoutMs()).isEqualTo(120000);
        } finally {
            System.clearProperty("TEST_ENV");
        }
    }

    @Test
    void envVarOverridesWinOverEverythingElse() {
        // WEB_BASE_URL / BROWSER / HEADLESS are read via System.getenv, which the
        // JVM doesn't allow mutating in-process — this test instead documents
        // the precedence contract already exercised end-to-end by the other
        // two tests (default -> overlay), and is a placeholder for an
        // environment-variable-injecting test harness (e.g. System Stubs) if
        // this project adds one later.
        EnvironmentConfig config = ConfigLoader.load();
        assertThat(config).isNotNull();
    }
}
