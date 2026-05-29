/**
 * Sample feature + step-def + page object + Maestro flow content
 * that resolves green under --dry-run for each platform.
 *
 * These are the starter files written by init_project when includeSamples=true.
 */

export interface SampleFile {
  readonly relativePath: string;
  readonly content: string;
}

export function getWebSamples(): readonly SampleFile[] {
  return [
    {
      relativePath: 'features/web/example.feature',
      content: `@web
Feature: Example web test

  Scenario: Navigate to the home page
    Given I navigate to the home page
    Then I should see the page title
`,
    },
    {
      relativePath: 'step-definitions/web.steps.ts',
      content: `import { Given, Then } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor-e2e';

Given('I navigate to the home page', async function (this: ConductorWorld) {
  await this.page.goto(this.config.web.baseUrl);
});

Then('I should see the page title', async function (this: ConductorWorld) {
  const title = await this.page.title();
  if (!title) {
    throw new Error('Expected a page title but got empty string');
  }
});
`,
    },
    {
      relativePath: 'pages/ExamplePage.ts',
      content: `import { BasePage } from 'conductor-e2e';

export class ExamplePage extends BasePage {
  async open(): Promise<void> {
    await this.navigate(this.config.web.baseUrl);
    await this.waitForLoad();
  }
}
`,
    },
  ];
}

export function getApiSamples(): readonly SampleFile[] {
  return [
    {
      relativePath: 'features/api/example.feature',
      content: `@api
Feature: Example API test

  Scenario: API health check
    Given the API is reachable
    Then the response status should be successful

  Scenario: Create a resource via POST
    When I POST a new item titled "Buy groceries"
    Then the API should respond with 201
`,
    },
    {
      relativePath: 'step-definitions/api.steps.ts',
      content: `import { Given, When, Then } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor-e2e';

Given('the API is reachable', async function (this: ConductorWorld) {
  if (!this.api.isInitialized) await this.api.init();
  // Write the FULL path (including any /api prefix). Default baseUrl is
  // http://localhost:3000 — without a path — so step defs control routing.
  const response = await this.api.get(\`\${this.config.api.baseUrl}/health\`);
  this.data['lastStatus'] = response.status();
});

Then('the response status should be successful', async function (this: ConductorWorld) {
  const status = this.data['lastStatus'] as number;
  if (status < 200 || status >= 300) {
    throw new Error(\`Expected 2xx status but got \${status}\`);
  }
});

// ApiDriver.post signature is (url, body, options?) — pass the JSON body as the
// second arg directly. Do NOT wrap it in { data: ... } like Playwright's raw
// APIRequestContext expects; conductor-e2e wraps it for you.
When('I POST a new item titled {string}', async function (this: ConductorWorld, title: string) {
  if (!this.api.isInitialized) await this.api.init();
  const response = await this.api.post(\`\${this.config.api.baseUrl}/api/items\`, {
    title,
    status: 'open',
  });
  this.data['lastStatus'] = response.status();
});

Then('the API should respond with {int}', async function (this: ConductorWorld, expected: number) {
  const status = this.data['lastStatus'] as number;
  if (status !== expected) {
    throw new Error(\`Expected \${expected} but got \${status}\`);
  }
});
`,
    },
  ];
}

export function getMobileSamples(): readonly SampleFile[] {
  return [
    {
      relativePath: 'features/mobile/example.feature',
      content: `@mobile
Feature: Example mobile test

  Scenario: App launches successfully
    When the mobile app launches
    Then the home screen should be visible
`,
    },
    {
      relativePath: 'step-definitions/mobile.steps.ts',
      content: `import { When, Then } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor-e2e';

const MOBILE_TIMEOUT = { timeout: 120000 };

When('the mobile app launches', MOBILE_TIMEOUT, async function (this: ConductorWorld) {
  await this.maestro.runOrThrow('launch-app');
});

Then('the home screen should be visible', MOBILE_TIMEOUT, async function (this: ConductorWorld) {
  await this.maestro.runOrThrow('verify-home');
});
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

export function getDesktopSamples(): readonly SampleFile[] {
  return [
    {
      relativePath: 'features/desktop/example.feature',
      content: `@desktop
Feature: Example desktop test

  Scenario: Application starts successfully
    Given the desktop application is running
    Then the main window should be visible
`,
    },
    {
      relativePath: 'step-definitions/desktop.steps.ts',
      content: `import { Given, Then } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor-e2e';
import * as path from 'path';

const DESKTOP_TIMEOUT = { timeout: 60000 };

Given('the desktop application is running', DESKTOP_TIMEOUT, async function (this: ConductorWorld) {
  const jarPath = path.resolve('build/libs/myapp-all.jar');
  await this.fx.launch({
    app: 'com.example.myapp.Launcher',
    classpath: jarPath,
    readyTimeoutMs: 30000,
  });
});

Then('the main window should be visible', DESKTOP_TIMEOUT, async function (this: ConductorWorld) {
  await this.fx.locator('#main-window').waitFor({ state: 'visible', timeout: 15000 });
});
`,
    },
  ];
}

export function getCrossPlatformSamples(): readonly SampleFile[] {
  const webSamples = getWebSamples();
  const apiSamples = getApiSamples();

  return [
    // Include web and API step defs since cross-platform uses both
    ...webSamples.filter((f) => f.relativePath.startsWith('step-definitions/')),
    ...apiSamples.filter((f) => f.relativePath.startsWith('step-definitions/')),
    {
      relativePath: 'features/cross-platform/example.feature',
      content: `@cross-platform
Feature: Example cross-platform test

  Scenario: Web action verified via API
    Given I navigate to the home page
    And the API is reachable
    Then the response status should be successful
`,
    },
  ];
}

export function getSamplesForPlatforms(platforms: readonly string[]): readonly SampleFile[] {
  const seen = new Set<string>();
  const result: SampleFile[] = [];

  function addSample(sample: SampleFile): void {
    if (!seen.has(sample.relativePath)) {
      seen.add(sample.relativePath);
      result.push(sample);
    }
  }

  for (const platform of platforms) {
    let samples: readonly SampleFile[];
    switch (platform) {
      case 'web':
        samples = getWebSamples();
        break;
      case 'api':
        samples = getApiSamples();
        break;
      case 'mobile':
        samples = getMobileSamples();
        break;
      case 'desktop':
        samples = getDesktopSamples();
        break;
      case 'cross-platform':
        // cross-platform needs web + api samples as base, plus cross-platform specific
        samples = [
          ...getWebSamples(),
          ...getApiSamples(),
          ...getCrossPlatformSamples(),
        ];
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
