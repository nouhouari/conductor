/**
 * Sample feature, Java step-definition, page object, and Maestro flow content
 * for Java Conductor projects created by init_project when includeSamples=true.
 */

export interface JavaSampleFile {
  readonly relativePath: string;
  readonly content: string;
}

function packagePath(packageName: string): string {
  return packageName.replaceAll('.', '/');
}

export function getJavaWebSamples(packageName: string): readonly JavaSampleFile[] {
  const basePath = packagePath(packageName);

  return [
    {
      relativePath: 'src/test/resources/features/web/example.feature',
      content: `@web
Feature: Example web test

  Scenario: Navigate to the home page
    Given I navigate to the home page
    Then I should see the page title
`,
    },
    {
      relativePath: `src/test/java/${basePath}/stepdefs/WebSteps.java`,
      content: `package ${packageName}.stepdefs;

import ${packageName}.pages.ExamplePage;
import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;

/** Starter web steps for the generated Conductor Java project. */
public class WebSteps {

    private final ConductorWorld world;

    public WebSteps(ConductorWorld world) {
        this.world = world;
    }

    @Given("I navigate to the home page")
    public void iNavigateToTheHomePage() {
        new ExamplePage(world.page(), world.config).open();
    }

    @Then("I should see the page title")
    public void iShouldSeeThePageTitle() {
        String title = world.page().title();
        if (title == null || title.isBlank()) {
            throw new AssertionError("Expected a page title but got blank");
        }
    }
}
`,
    },
    {
      relativePath: `src/test/java/${basePath}/pages/ExamplePage.java`,
      content: `package ${packageName}.pages;

import com.microsoft.playwright.Page;
import com.nouhouari.conductor.config.EnvironmentConfig;
import com.nouhouari.conductor.pages.BasePage;

/** Starter page object for the generated Conductor Java project. */
public class ExamplePage extends BasePage {

    public ExamplePage(Page page, EnvironmentConfig config) {
        super(page, config);
    }

    public void open() {
        navigate(config.web().baseUrl());
        waitForLoad();
    }
}
`,
    },
  ];
}

export function getJavaApiSamples(packageName: string): readonly JavaSampleFile[] {
  const basePath = packagePath(packageName);

  return [
    {
      relativePath: 'src/test/resources/features/api/example.feature',
      content: `@api
Feature: Example API test

  Scenario: API health check
    Given the API is reachable
    Then the response status should be successful
`,
    },
    {
      relativePath: `src/test/java/${basePath}/stepdefs/ApiSteps.java`,
      content: `package ${packageName}.stepdefs;

import com.microsoft.playwright.APIResponse;
import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;

/** Starter API steps for the generated Conductor Java project. */
public class ApiSteps {

    private final ConductorWorld world;

    public ApiSteps(ConductorWorld world) {
        this.world = world;
    }

    @Given("the API is reachable")
    public void theApiIsReachable() {
        if (!world.api().isInitialized()) {
            world.api().init();
        }
        APIResponse response = world.api().get(world.config.api().baseUrl() + "/health");
        world.data.put("lastStatus", response.status());
    }

    @Then("the response status should be successful")
    public void theResponseStatusShouldBeSuccessful() {
        int status = (Integer) world.data.get("lastStatus");
        if (status < 200 || status >= 300) {
            throw new AssertionError("Expected 2xx status but got " + status);
        }
    }
}
`,
    },
  ];
}

export function getJavaMobileSamples(packageName: string): readonly JavaSampleFile[] {
  const basePath = packagePath(packageName);

  return [
    {
      relativePath: 'src/test/resources/features/mobile/example.feature',
      content: `@mobile
Feature: Example mobile test

  Scenario: App launches successfully
    When the mobile app launches
    Then the home screen should be visible
`,
    },
    {
      relativePath: `src/test/java/${basePath}/stepdefs/MobileSteps.java`,
      content: `package ${packageName}.stepdefs;

import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

/** Starter Maestro mobile steps for the generated Conductor Java project. */
public class MobileSteps {

    private final ConductorWorld world;

    public MobileSteps(ConductorWorld world) {
        this.world = world;
    }

    @When("the mobile app launches")
    public void theMobileAppLaunches() {
        world.maestro().runOrThrow("launch-app");
    }

    @Then("the home screen should be visible")
    public void theHomeScreenShouldBeVisible() {
        world.maestro().runOrThrow("verify-home");
    }
}
`,
    },
    {
      relativePath: 'flows/mobile/launch-app.yaml',
      content: `appId: com.example.myapp
---
- launchApp:
    clearState: false
- assertVisible: "Home"
- takeScreenshot: "home-screen"
`,
    },
    {
      relativePath: 'flows/mobile/verify-home.yaml',
      content: `appId: com.example.myapp
---
- assertVisible: "Home"
`,
    },
  ];
}

export function getJavaDesktopSamples(packageName: string): readonly JavaSampleFile[] {
  const basePath = packagePath(packageName);

  return [
    {
      relativePath: 'src/test/resources/features/desktop/example.feature',
      content: `@desktop
Feature: Example JavaFX desktop test

  Scenario: Application starts successfully
    Given the desktop application is running
    Then the main window should be visible
`,
    },
    {
      relativePath: `src/test/java/${basePath}/stepdefs/DesktopSteps.java`,
      content: `package ${packageName}.stepdefs;

import com.nouhouari.conductor.drivers.JavaFxDriver;
import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;

import java.nio.file.Paths;
import java.util.List;

/** Starter JavaFX desktop steps for the generated Conductor Java project. */
public class DesktopSteps {

    private final ConductorWorld world;

    public DesktopSteps(ConductorWorld world) {
        this.world = world;
    }

    @Given("the desktop application is running")
    public void theDesktopApplicationIsRunning() {
        String jarPath = Paths.get("build/libs/myapp-all.jar").toAbsolutePath().normalize().toString();
        world.fx().launch(new JavaFxDriver.LaunchOptions(
                "com.example.myapp.Launcher",
                jarPath,
                List.of(),
                30000));
    }

    @Then("the main window should be visible")
    public void theMainWindowShouldBeVisible() {
        world.fx().locator("#main-window").waitFor(new JavaFxDriver.WaitOptions("visible", 15000));
    }
}
`,
    },
  ];
}

export function getJavaFlutterDesktopSamples(packageName: string): readonly JavaSampleFile[] {
  const basePath = packagePath(packageName);

  return [
    {
      relativePath: 'src/test/resources/features/flutter-desktop/example.feature',
      content: `@flutter-desktop
Feature: Example Flutter desktop test

  Scenario: Flutter desktop application starts successfully
    Given the Flutter desktop app is running
    Then the Flutter desktop home screen should be visible
`,
    },
    {
      relativePath: `src/test/java/${basePath}/stepdefs/FlutterDesktopSteps.java`,
      content: `package ${packageName}.stepdefs;

import com.nouhouari.conductor.drivers.FlutterDesktopDriver.Finder;
import com.nouhouari.conductor.drivers.FlutterDesktopDriver.FinderType;
import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;

/** Starter Flutter desktop steps for the generated Conductor Java project. */
public class FlutterDesktopSteps {

    private final ConductorWorld world;

    public FlutterDesktopSteps(ConductorWorld world) {
        this.world = world;
    }

    private static Finder byText(String text) {
        return new Finder(FinderType.ByText, text);
    }

    @Given("the Flutter desktop app is running")
    public void theFlutterDesktopAppIsRunning() {
        world.flutterDesktop().launch();
    }

    @Then("the Flutter desktop home screen should be visible")
    public void theFlutterDesktopHomeScreenShouldBeVisible() {
        world.flutterDesktop().waitFor(byText("Home"));
    }
}
`,
    },
  ];
}

export function getJavaCrossPlatformSamples(packageName: string): readonly JavaSampleFile[] {
  const basePath = packagePath(packageName);

  return [
    {
      relativePath: 'src/test/resources/features/cross-platform/example.feature',
      content: `@cross-platform
Feature: Example cross-platform test

  Scenario: Web, API, and mobile channels are available
    Given I open the web app in a cross-platform scenario
    When I query the API in a cross-platform scenario
    Then the mobile home screen can be verified
`,
    },
    {
      relativePath: `src/test/java/${basePath}/stepdefs/CrossPlatformSteps.java`,
      content: `package ${packageName}.stepdefs;

import com.microsoft.playwright.APIResponse;
import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

/** Starter cross-platform steps for the generated Conductor Java project. */
public class CrossPlatformSteps {

    private final ConductorWorld world;

    public CrossPlatformSteps(ConductorWorld world) {
        this.world = world;
    }

    @Given("I open the web app in a cross-platform scenario")
    public void iOpenTheWebAppInACrossPlatformScenario() {
        world.page().navigate(world.config.web().baseUrl());
    }

    @When("I query the API in a cross-platform scenario")
    public void iQueryTheApiInACrossPlatformScenario() {
        if (!world.api().isInitialized()) {
            world.api().init(world.web().getContext());
        }
        APIResponse response = world.api().get(world.config.api().baseUrl() + "/health");
        world.data.put("lastStatus", response.status());
    }

    @Then("the mobile home screen can be verified")
    public void theMobileHomeScreenCanBeVerified() {
        int status = (Integer) world.data.get("lastStatus");
        if (status < 200 || status >= 300) {
            throw new AssertionError("Expected 2xx status but got " + status);
        }
        world.maestro().runOrThrow("verify-home");
    }
}
`,
    },
    ...getJavaMobileSamples(packageName).filter((sample) => sample.relativePath.startsWith('flows/mobile/')),
  ];
}

export function getJavaSamplesForPlatforms(platforms: readonly string[], packageName: string): readonly JavaSampleFile[] {
  const seen = new Set<string>();
  const result: JavaSampleFile[] = [];

  function addSample(sample: JavaSampleFile): void {
    if (!seen.has(sample.relativePath)) {
      seen.add(sample.relativePath);
      result.push(sample);
    }
  }

  for (const platform of platforms) {
    let samples: readonly JavaSampleFile[];
    switch (platform) {
      case 'web':
        samples = getJavaWebSamples(packageName);
        break;
      case 'api':
        samples = getJavaApiSamples(packageName);
        break;
      case 'mobile':
        samples = getJavaMobileSamples(packageName);
        break;
      case 'desktop':
        samples = getJavaDesktopSamples(packageName);
        break;
      case 'flutter-desktop':
        samples = getJavaFlutterDesktopSamples(packageName);
        break;
      case 'cross-platform':
        samples = getJavaCrossPlatformSamples(packageName);
        break;
      default:
        samples = [];
    }
    for (const sample of samples) {
      addSample(sample);
    }
  }

  return result;
}
