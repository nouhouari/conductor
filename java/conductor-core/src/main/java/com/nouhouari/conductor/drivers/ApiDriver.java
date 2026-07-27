package com.nouhouari.conductor.drivers;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.type.CollectionType;
import com.microsoft.playwright.APIRequest;
import com.microsoft.playwright.APIRequestContext;
import com.microsoft.playwright.APIResponse;
import com.microsoft.playwright.BrowserContext;
import com.microsoft.playwright.options.RequestOptions;
import com.nouhouari.conductor.config.EnvironmentConfig;
import com.nouhouari.conductor.world.PlaywrightHolder;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Map;

/**
 * Java port of src/drivers/ApiDriver.ts. Playwright Java's APIResponse has no
 * .json() convenience method (unlike Playwright Node) — {@link #json} /
 * {@link #jsonList} fill that gap via Jackson.
 */
public class ApiDriver {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final EnvironmentConfig config;
    private APIRequestContext client;

    public ApiDriver(EnvironmentConfig config) {
        this.config = config;
    }

    public void init() {
        init(null);
    }

    /** Reuses a BrowserContext's request context when provided, sharing cookies (used by @cross-platform). */
    public void init(BrowserContext context) {
        if (context != null) {
            client = context.request();
        } else {
            client = PlaywrightHolder.get().request().newContext(new APIRequest.NewContextOptions()
                    .setBaseURL(config.api().baseUrl())
                    .setExtraHTTPHeaders(Map.of("Content-Type", "application/json")));
        }
    }

    public APIRequestContext getClient() {
        if (client == null) {
            throw new IllegalStateException("ApiDriver not initialized. Call init() first.");
        }
        return client;
    }

    public boolean isInitialized() {
        return client != null;
    }

    public APIResponse get(String url) {
        return getClient().get(url);
    }

    public APIResponse post(String url, Object data) {
        return getClient().post(url, RequestOptions.create().setData(data));
    }

    public APIResponse put(String url, Object data) {
        return getClient().put(url, RequestOptions.create().setData(data));
    }

    public APIResponse delete(String url) {
        return getClient().delete(url);
    }

    public <T> T json(APIResponse response, Class<T> type) {
        try {
            return MAPPER.readValue(response.body(), type);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public <T> List<T> jsonList(APIResponse response, Class<T> elementType) {
        try {
            CollectionType listType = MAPPER.getTypeFactory().constructCollectionType(List.class, elementType);
            return MAPPER.readValue(response.body(), listType);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    public void dispose() {
        if (client != null) {
            client.dispose();
            client = null;
        }
    }
}
