package com.nouhouari.conductor.example.suites;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.Suite;

import static io.cucumber.junit.platform.engine.Constants.FEATURES_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;

/**
 * Java equivalent of cucumber.js's "remote" profile: runs scenarios
 * reconstructed from the requ scenario API by {@code FetchFeaturesCli}.
 *
 * <p>No fixed tags — filtering happens server-side at fetch time; a local
 * {@code -Dcucumber.filter.tags} expression still works.
 *
 * <p>Run the fetch step first, then this suite:
 * <pre>{@code
 * mvn -pl conductor-core exec:java \
 *   -Dexec.mainClass=com.nouhouari.conductor.scenarios.FetchFeaturesCli
 * mvn -pl conductor-example test -Dtest=RemoteSuiteTest
 * }</pre>
 *
 * <p>The features path defaults to {@code .remote-features} (matching the TS
 * profile's default), resolved against this module's basedir. The fetch step
 * creates that directory, so the default workflow needs no extra flags.
 *
 * <p>If {@code remoteScenarios.outputDir} points somewhere else, pass
 * {@code -Dcucumber.features=<dir>} — it takes precedence over the annotation
 * below. Note that JUnit still validates the annotated path at discovery time,
 * so {@code .remote-features} must exist even when overridden (an empty
 * directory is enough).
 */
@Suite
@IncludeEngines("cucumber")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME,
        value = "com.nouhouari.conductor.hooks,com.nouhouari.conductor.example.stepdefs")
@ConfigurationParameter(key = FEATURES_PROPERTY_NAME, value = ".remote-features")
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME,
        value = "pretty, io.qameta.allure.cucumber7jvm.AllureCucumber7Jvm, json:target/cucumber-report.json")
public class RemoteSuiteTest {
}
