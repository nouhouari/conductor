/**
 * Generates README.md content for a bootstrapped Java Conductor project.
 */

import { getJavaSuiteClassName } from './java-suites.js';
import { CONDUCTOR_JAVA_VERSION } from './java-pom.js';

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

This project depends on \`io.github.nouhouari.conductor:conductor-core:${CONDUCTOR_JAVA_VERSION}\`, published to Maven Central — no extra repository or credentials needed:

\`\`\`bash
mvn -q install -DskipTests
\`\`\`

Working from a local checkout of the Conductor monorepo instead? Install the
core artifact into your local repository and point \`<conductor.version>\` at
the \`-SNAPSHOT\` version it builds:

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
