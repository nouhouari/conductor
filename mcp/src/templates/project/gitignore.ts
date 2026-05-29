/**
 * Generates .gitignore content for a bootstrapped Conductor test project.
 */

export function renderGitignore(): string {
  return `# Dependencies
node_modules/

# Build output
dist/

# Test reports and screenshots
reports/
allure-results/
allure-report/

# Environment secrets
.env

# OS
.DS_Store
Thumbs.db

# Editor
.vscode/
.idea/
*.swp
*.swo
`;
}
