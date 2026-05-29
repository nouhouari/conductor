/**
 * Generates README.md content for a bootstrapped Conductor test project.
 */

export function renderReadme(projectName: string, platforms: readonly string[]): string {
  const platformList = platforms.map((p) => `- ${p}`).join('\n');

  const runCommands: string[] = ['```bash', 'npm test              # all scenarios', 'npm run test:dry-run  # validate step definitions'];

  if (platforms.includes('web') || platforms.includes('cross-platform')) {
    runCommands.push('npm run test:web      # web scenarios only');
  }
  if (platforms.includes('api') || platforms.includes('cross-platform')) {
    runCommands.push('npm run test:api      # API scenarios only');
  }
  if (platforms.includes('mobile') || platforms.includes('cross-platform')) {
    runCommands.push('npm run test:mobile   # mobile scenarios only');
  }
  if (platforms.includes('desktop') || platforms.includes('cross-platform')) {
    runCommands.push('npm run test:desktop  # desktop scenarios only');
  }
  if (platforms.includes('cross-platform')) {
    runCommands.push('npm run test:cross    # cross-platform scenarios');
  }
  runCommands.push('```');

  return `# ${projectName}

E2E test project using [Conductor](https://github.com/nouhouari/conductor).

## Platforms

${platformList}

## Setup

\`\`\`bash
npm install
npx playwright install chromium
\`\`\`

## Running Tests

${runCommands.join('\n')}

## Reports

\`\`\`bash
npm run report       # generate Allure HTML report
npm run report:open  # open the report in browser
\`\`\`

## Project Layout

\`\`\`
features/           Gherkin .feature files, grouped by platform
step-definitions/   TypeScript step definitions
pages/              Page objects (extend BasePage)
flows/mobile/       Maestro YAML flows (if using mobile)
reports/            Test output and screenshots
\`\`\`

## Configuration

Copy \`.env.example\` to \`.env\` and set the values for your environment.
See [Conductor User Guide](https://github.com/nouhouari/conductor/blob/main/docs/USER_GUIDE.md) for full documentation.
`;
}
