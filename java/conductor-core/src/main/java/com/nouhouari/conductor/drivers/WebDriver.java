package com.nouhouari.conductor.drivers;

import com.microsoft.playwright.Browser;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.BrowserType;
import com.microsoft.playwright.Page;
import com.nouhouari.conductor.config.EnvironmentConfig;
import com.nouhouari.conductor.config.Viewport;
import com.nouhouari.conductor.world.PlaywrightHolder;

import java.nio.file.Path;
import java.nio.file.Paths;

/** Java port of src/drivers/WebDriver.ts. */
public class WebDriver {

    private final EnvironmentConfig config;
    private Browser browser;
    private BrowserContext context;
    private Page page;

    public WebDriver(EnvironmentConfig config) {
        this.config = config;
    }

    public void launch() {
        launch(null, null);
    }

    public void launch(Boolean headlessOverride, Integer slowMoOverride) {
        var web = config.web();
        BrowserType launcher = switch (web.browserName()) {
            case "firefox" -> PlaywrightHolder.get().firefox();
            case "webkit" -> PlaywrightHolder.get().webkit();
            default -> PlaywrightHolder.get().chromium();
        };

        BrowserType.LaunchOptions launchOptions = new BrowserType.LaunchOptions()
                .setHeadless(headlessOverride != null ? headlessOverride : web.headless());
        Integer slowMo = slowMoOverride != null ? slowMoOverride : web.slowMo();
        if (slowMo != null) {
            launchOptions.setSlowMo(slowMo.doubleValue());
        }
        browser = launcher.launch(launchOptions);

        Viewport viewport = web.viewport();
        context = browser.newContext(new Browser.NewContextOptions()
                .setBaseURL(web.baseUrl())
                .setViewportSize(viewport != null ? viewport.width() : 1280,
                        viewport != null ? viewport.height() : 720));
        page = context.newPage();
    }

    public void close() {
        if (page != null) {
            page.close();
        }
        if (context != null) {
            context.close();
        }
        if (browser != null) {
            browser.close();
        }
        page = null;
        context = null;
        browser = null;
    }

    public Page getPage() {
        if (page == null) {
            throw new IllegalStateException("Browser not launched. Call launch() first.");
        }
        return page;
    }

    public BrowserContext getContext() {
        if (context == null) {
            throw new IllegalStateException("Browser not launched. Call launch() first.");
        }
        return context;
    }

    public Browser getBrowser() {
        if (browser == null) {
            throw new IllegalStateException("Browser not launched. Call launch() first.");
        }
        return browser;
    }

    public boolean isLaunched() {
        return browser != null;
    }

    public byte[] takeScreenshot(String name) {
        Path path = Paths.get("reports/screenshots", name + ".png");
        return getPage().screenshot(new Page.ScreenshotOptions().setPath(path).setFullPage(true));
    }
}
