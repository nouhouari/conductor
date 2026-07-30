package com.nouhouari.conductor.world;

import com.microsoft.playwright.APIRequestContext;
import com.microsoft.playwright.Page;
import com.nouhouari.conductor.config.ConfigLoader;
import com.nouhouari.conductor.config.EnvironmentConfig;
import com.nouhouari.conductor.drivers.ApiDriver;
import com.nouhouari.conductor.drivers.DatabaseDriver;
import com.nouhouari.conductor.drivers.FlutterDesktopDriver;
import com.nouhouari.conductor.drivers.JavaFxDriver;
import com.nouhouari.conductor.drivers.MaestroDriver;
import com.nouhouari.conductor.drivers.WebDriver;
import io.cucumber.java.Scenario;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.HashMap;
import java.util.Map;

/**
 * Java port of src/world/ConductorWorld.ts. Cucumber-JVM has no "World" base
 * class; this is instead a plain scenario-scoped object, constructor-injected
 * by PicoContainer into every step-def/hook class that declares it as a
 * constructor parameter — the direct equivalent of TS's {@code this: ConductorWorld}
 * binding.
 */
public class ConductorWorld {

    public final EnvironmentConfig config = ConfigLoader.get();
    public final Logger logger = LoggerFactory.getLogger("conductor");
    public final Map<String, Object> data = new HashMap<>();

    /**
     * Captured by {@code hooks.ScenarioContextHooks} at the start of every
     * scenario. Cucumber-JVM only injects {@link Scenario} into @Before/@After
     * hook methods, not into @Given/@When/@Then step methods (unlike TS
     * Cucumber's {@code this.attach(...)}, available in every step) — this is
     * the standard workaround, used by ScreenshotSteps/DesktopSteps/etc. to
     * call {@code world.scenario.attach(...)} from a regular step.
     */
    public Scenario scenario;

    private WebDriver webDriver;
    private ApiDriver apiDriver;
    private MaestroDriver maestroDriver;
    private JavaFxDriver fxDriver;
    private FlutterDesktopDriver flutterDesktopDriver;
    private DatabaseDriver dbDriver;

    public WebDriver web() {
        if (webDriver == null) {
            webDriver = new WebDriver(config);
        }
        return webDriver;
    }

    public Page page() {
        return web().getPage();
    }

    public ApiDriver api() {
        if (apiDriver == null) {
            apiDriver = new ApiDriver(config);
        }
        return apiDriver;
    }

    public APIRequestContext request() {
        return api().getClient();
    }

    public MaestroDriver maestro() {
        if (maestroDriver == null) {
            maestroDriver = new MaestroDriver(config);
        }
        return maestroDriver;
    }

    public JavaFxDriver fx() {
        if (fxDriver == null) {
            if (config.desktop() == null) {
                throw new IllegalStateException("No desktop config. Set config.desktop with DesktopConfig.");
            }
            fxDriver = new JavaFxDriver(config.desktop());
        }
        return fxDriver;
    }

    public boolean isFxLaunched() {
        return fxDriver != null && fxDriver.isLaunched();
    }

    public FlutterDesktopDriver flutterDesktop() {
        if (flutterDesktopDriver == null) {
            if (config.flutterDesktop() == null) {
                throw new IllegalStateException("No flutterDesktop config. Set config.flutterDesktop with FlutterDesktopConfig.");
            }
            flutterDesktopDriver = new FlutterDesktopDriver(config.flutterDesktop());
        }
        return flutterDesktopDriver;
    }

    public boolean isFlutterDesktopLaunched() {
        return flutterDesktopDriver != null && flutterDesktopDriver.isLaunched();
    }

    public void setDb(DatabaseDriver driver) {
        this.dbDriver = driver;
    }

    public DatabaseDriver db() {
        if (dbDriver == null) {
            throw new IllegalStateException("No DatabaseDriver registered. Call world.setDb(adapter) in a Before hook.");
        }
        return dbDriver;
    }

    public boolean hasDb() {
        return dbDriver != null;
    }

    public void closeWeb() {
        if (webDriver != null) {
            webDriver.close();
            webDriver = null;
        }
    }

    public void disposeApi() {
        if (apiDriver != null) {
            apiDriver.dispose();
            apiDriver = null;
        }
    }

    public void closeFx() {
        if (fxDriver != null) {
            fxDriver.close();
            fxDriver = null;
        }
    }

    public void closeFlutterDesktop() {
        if (flutterDesktopDriver != null) {
            flutterDesktopDriver.close();
            flutterDesktopDriver = null;
        }
    }

    public void disconnectDb() {
        if (dbDriver != null) {
            dbDriver.disconnect();
            dbDriver = null;
        }
    }
}
