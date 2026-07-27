package com.nouhouari.conductor.world;

import com.microsoft.playwright.Playwright;

/**
 * One {@link Playwright} instance per JVM process (it spins up a driver
 * subprocess under the hood — expensive to create per-scenario). WebDriver
 * and ApiDriver both draw from this instead of each owning their own.
 *
 * <p>Closed automatically via a JVM shutdown hook; there is no natural
 * "end of test run" callback shared by all Cucumber-JVM execution modes
 * (JUnit Platform Suite, plain `cucumber.api.cli.Main`, IDE runners), so the
 * shutdown hook is the one mechanism guaranteed to fire in every case.
 */
public final class PlaywrightHolder {

    private static volatile Playwright instance;

    private PlaywrightHolder() {
    }

    public static Playwright get() {
        Playwright result = instance;
        if (result == null) {
            synchronized (PlaywrightHolder.class) {
                result = instance;
                if (result == null) {
                    instance = result = Playwright.create();
                    Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                        Playwright current = instance;
                        if (current != null) {
                            current.close();
                        }
                    }, "playwright-holder-shutdown"));
                }
            }
        }
        return result;
    }
}
