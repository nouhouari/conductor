/**
 * Generates README.md content for a bootstrapped Java Conductor project.
 */

import { getJavaSuiteClassName } from './java-suites.js';

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

Install the Conductor Java core artifact first, then install this project:

\`\`\`bash
# From the Conductor monorepo:
cd java && mvn -q install -DskipTests

# From this generated project:
mvn -q install -DskipTests
\`\`\`

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
