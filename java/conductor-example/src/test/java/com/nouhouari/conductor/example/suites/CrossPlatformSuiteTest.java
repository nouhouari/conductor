package com.nouhouari.conductor.example.suites;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.Suite;

import static io.cucumber.junit.platform.engine.Constants.FEATURES_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.FILTER_TAGS_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;

/** Java equivalent of running {@code cucumber-js --tags @cross-platform} against the full features tree. */
@Suite
@IncludeEngines("cucumber")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME,
        value = "com.nouhouari.conductor.hooks,com.nouhouari.conductor.example.stepdefs")
@ConfigurationParameter(key = FEATURES_PROPERTY_NAME, value = "../../example/features")
@ConfigurationParameter(key = FILTER_TAGS_PROPERTY_NAME, value = "@cross-platform")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME,
        value = "pretty, io.qameta.allure.cucumber7jvm.AllureCucumber7Jvm, json:target/cucumber-report.json")
public class CrossPlatformSuiteTest {
}
