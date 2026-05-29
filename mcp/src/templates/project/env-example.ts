/**
 * Generates .env.example content for a bootstrapped Conductor test project.
 */

export function renderEnvExample(
  platforms: readonly string[],
  webBaseUrl?: string,
): string {
  const baseUrl = webBaseUrl?.trim() || 'http://localhost:3000';
  const lines: string[] = [
    '# Conductor E2E environment configuration',
    '# Copy to .env and fill in your values',
    '',
    '# Environment selector (default, dev, staging)',
    'TEST_ENV=default',
    '',
    '# Web driver',
    `WEB_BASE_URL=${baseUrl}`,
    'HEADLESS=true',
    'BROWSER=chromium',
    '',
    '# API driver',
    '# Do NOT include the /api (or any) path here — step definitions write the full path',
    '# (e.g., `${this.config.api.baseUrl}/api/todos`). Putting /api here causes /api/api/...',
    `API_BASE_URL=${baseUrl}`,
    '',
  ];

  if (platforms.includes('mobile') || platforms.includes('cross-platform')) {
    lines.push(
      '# Mobile (Maestro)',
      '# MAESTRO_DEVICE=emulator-5554',
      '# ANDROID_HOME=/path/to/android-sdk',
      '# DEBUG_MAESTRO=1',
      '',
    );
  }

  if (platforms.includes('desktop') || platforms.includes('cross-platform')) {
    lines.push(
      '# Desktop (JavaFX)',
      '# DESKTOP_AGENT_JAR=./agent/fxagent.jar',
      '',
    );
  }

  if (platforms.includes('cross-platform')) {
    lines.push(
      '# Database (cross-platform)',
      '# DATABASE_URL=postgresql://user:pass@localhost:5432/mydb',
      '',
    );
  }

  return lines.join('\n');
}
