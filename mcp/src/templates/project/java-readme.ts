/**
 * Generates README.md content for a bootstrapped Java Conductor project.
 */

import { getJavaSuiteClassName } from './java-suites.js';
import { CONDUCTOR_JAVA_VERSION, CONDUCTOR_MAVEN_REPO_ID } from './java-pom.js';

export function renderJavaReadme(projectName: string, platforms: readonly string[]): string {
  const platformList = platforms.map((p) => `- ${p}`).join('\n');
  const runCommands = ['```bash', 'mvn test                 # all scenarios'];

  for (const platform of platforms) {
    runCommands.push(`mvn test -Dtest=${getJavaSuiteClassName(platform as Parameters<typeof getJavaSuiteClassName>[0])}  # ${platform} scenarios`);
  }
  runCommands.push('```');

  return `# ${projectName}

E2E test project using Conductor Java and Cucumber-JVM.

## Platforms

${platformList}

## Setup

This project depends on \`com.nouhouari.conductor:conductor-core:${CONDUCTOR_JAVA_VERSION}\`, published to GitHub Packages. Maven requires authentication for GitHub Packages even on public repositories, so add a matching \`<server>\` to your \`~/.m2/settings.xml\` using a personal access token with the \`read:packages\` scope:

\`\`\`xml
<server>
  <id>${CONDUCTOR_MAVEN_REPO_ID}</id>
  <username>YOUR_GITHUB_USERNAME</username>
  <password>YOUR_TOKEN_WITH_read:packages</password>
</server>
\`\`\`

Then:

\`\`\`bash
mvn -q install -DskipTests
\`\`\`

Working from a local checkout of the Conductor monorepo instead? Install the
core artifact yourself and remove the \`<repositories>\` block from \`pom.xml\`:

\`\`\`bash
cd java && mvn -q install -DskipTests
\`\`\`

Bump the \`<conductor.version>\` property in \`pom.xml\` to upgrade the framework.

For web/API tests backed by Playwright Java, install the browser binaries when needed:

\`\`\`bash
mvn exec:java -e -Dexec.mainClass=com.microsoft.playwright.CLI -Dexec.args="install chromium"
\`\`\`

## Running Tests

${runCommands.join('\n')}

## Project Layout

\`\`\`
src/test/java/        Java step definitions, page objects, and JUnit suites
src/test/resources/   Feature files and Conductor config overlays
flows/mobile/         Maestro YAML flows (if using mobile)
reports/              Test output and screenshots
\`\`\`

## Configuration

Edit \`src/test/resources/config/local-overrides.yml\` for web/API base URLs,
Maestro flow paths, JavaFX agent paths, or Flutter desktop executable paths.
`;
}
