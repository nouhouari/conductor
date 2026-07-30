/**
 * Generates JUnit Platform @Suite classes for Java Conductor projects.
 * The shape mirrors java/conductor-example's suite classes.
 */

export type JavaSuitePlatform = 'web' | 'api' | 'mobile' | 'desktop' | 'flutter-desktop' | 'cross-platform' | 'all';

interface SuiteInfo {
  readonly className: string;
  readonly featurePath: string;
  readonly tag?: string;
  readonly description: string;
}

const SUITES: Record<JavaSuitePlatform, SuiteInfo> = {
  web: {
    className: 'WebSuiteTest',
    featurePath: 'src/test/resources/features/web',
    tag: '@web',
    description: 'Web scenarios tagged {@code @web}.',
  },
  api: {
    className: 'ApiSuiteTest',
    featurePath: 'src/test/resources/features/api',
    tag: '@api',
    description: 'API scenarios tagged {@code @api}.',
  },
  mobile: {
    className: 'MobileSuiteTest',
    featurePath: 'src/test/resources/features/mobile',
    tag: '@mobile',
    description: 'Mobile scenarios tagged {@code @mobile}.',
  },
  desktop: {
    className: 'DesktopSuiteTest',
    featurePath: 'src/test/resources/features/desktop',
    tag: '@desktop',
    description: 'JavaFX desktop scenarios tagged {@code @desktop}.',
  },
  'flutter-desktop': {
    className: 'FlutterDesktopSuiteTest',
    featurePath: 'src/test/resources/features/flutter-desktop',
    tag: '@flutter-desktop',
    description: 'Flutter desktop scenarios tagged {@code @flutter-desktop}.',
  },
  'cross-platform': {
    className: 'CrossPlatformSuiteTest',
    featurePath: 'src/test/resources/features/cross-platform',
    tag: '@cross-platform',
    description: 'Cross-platform scenarios tagged {@code @cross-platform}.',
  },
  all: {
    className: 'DefaultSuiteTest',
    featurePath: 'src/test/resources/features',
    description: 'Default suite: all local feature files, with no tag filter.',
  },
};

export function getJavaSuiteClassName(platform: JavaSuitePlatform): string {
  return SUITES[platform].className;
}

export function renderJavaSuite(platform: JavaSuitePlatform, packageName: string): string {
  const suite = SUITES[platform];
  const tagParameter = suite.tag
    ? `\n@ConfigurationParameter(key = FILTER_TAGS_PROPERTY_NAME, value = "${suite.tag}")`
    : '';
  const filterImport = suite.tag
    ? 'import static io.cucumber.junit.platform.engine.Constants.FILTER_TAGS_PROPERTY_NAME;\n'
    : '';

  return `package ${packageName}.suites;

import org.junit.platform.suite.api.ConfigurationParameter;
import org.junit.platform.suite.api.IncludeEngines;
import org.junit.platform.suite.api.Suite;

import static io.cucumber.junit.platform.engine.Constants.FEATURES_PROPERTY_NAME;
${filterImport}import static io.cucumber.junit.platform.engine.Constants.GLUE_PROPERTY_NAME;
import static io.cucumber.junit.platform.engine.Constants.PLUGIN_PROPERTY_NAME;

/** ${suite.description} */
@Suite
@IncludeEngines("cucumber")
@ConfigurationParameter(key = GLUE_PROPERTY_NAME,
        value = "com.nouhouari.conductor.hooks,${packageName}.stepdefs")
@ConfigurationParameter(key = FEATURES_PROPERTY_NAME, value = "${suite.featurePath}")${tagParameter}
@ConfigurationParameter(key = PLUGIN_PROPERTY_NAME,
        value = "pretty, io.qameta.allure.cucumber7jvm.AllureCucumber7Jvm, json:target/cucumber-report.json")
public class ${suite.className} {
}
`;
}
