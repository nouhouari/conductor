/**
 * Generates .gitignore content for a bootstrapped Java Conductor project.
 */

export function renderJavaGitignore(): string {
  return `# Maven / Java build output
target/

# Test reports and screenshots
reports/
allure-results/
allure-report/

# OS
.DS_Store
Thumbs.db

# Editor
.vscode/
.idea/
*.iml
*.swp
*.swo
`;
}
