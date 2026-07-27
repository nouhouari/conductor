package com.nouhouari.conductor.example.suites;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.Suite;

import static io.cucumber.junit.platform.engine.Constants.FEATURES_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;

/**
 * Java equivalent of cucumber.js's "default" profile: full example/features/**
 * tree, no tag filter. One JUnit 5 {@code @Suite} class per TS profile —
 * chosen over Maven profiles because a Suite class runs identically from
 * Maven, an IDE's run gutter, or a CI matrix step (see the migration plan's
 * §2.5 for the rationale).
 */
@Suite
@IncludeEngines("cucumber")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME,
        value = "com.nouhouari.conductor.hooks,com.nouhouari.conductor.example.stepdefs")
@ConfigurationParameter(key = FEATURES_PROPERTY_NAME, value = "../../example/features")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME,
        value = "pretty, io.qameta.allure.cucumber7jvm.AllureCucumber7Jvm, json:target/cucumber-report.json")
public class DefaultSuiteTest {
}
