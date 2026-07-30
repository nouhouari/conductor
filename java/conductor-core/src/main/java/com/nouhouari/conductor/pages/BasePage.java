package com.nouhouari.conductor.pages;

import com.microsoft.playwright.Page;
import com.microsoft.playwright.options.LoadState;
import com.nouhouari.conductor.config.EnvironmentConfig;

/** Java port of src/pages/BasePage.ts. */
public abstract class BasePage {

    protected final Page page;
    protected final EnvironmentConfig config;

    protected BasePage(Page page, EnvironmentConfig config) {
        this.page = page;
        this.config = config;
    }

    public void navigate(String path) {
        page.navigate(path);
    }

    public void waitForLoad() {
        page.waitForLoadState(LoadState.NETWORKIDLE);
    }

    public String getTitle() {
        return page.title();
    }
}
