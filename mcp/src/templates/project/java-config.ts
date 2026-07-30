/**
 * Generates classpath configuration overlays for Java Conductor projects.
 * ConfigLoader merges this file over conductor-core's config/default.yml.
 */

export interface JavaConfigYmlOptions {
  readonly platforms: readonly string[];
  readonly webBaseUrl?: string;
}

export function renderJavaConfigYml(options: JavaConfigYmlOptions): string {
  const { platforms, webBaseUrl } = options;
  const baseUrl = webBaseUrl ?? 'http://localhost:3000';
  const needsMobile = platforms.includes('mobile') || platforms.includes('cross-platform');
  const needsDesktop = platforms.includes('desktop') || platforms.includes('cross-platform');
  const needsFlutterDesktop = platforms.includes('flutter-desktop');

  const sections = [`# Project-specific overrides merged over conductor-core's config/default.yml.
# Maven resource filtering substitutes \${project.basedir} at test-resource processing time.
name: local
web:
  baseUrl: ${baseUrl}
api:
  baseUrl: ${baseUrl}`];

  if (needsMobile) {
    sections.push(`mobile:
  flowsDir: "\${project.basedir}/flows/mobile"`);
  }

  if (needsDesktop) {
    sections.push(`desktop:
  agentJar: "\${project.basedir}/apps/desktop/agent/fxagent.jar"
  defaultTimeoutMs: 10000
  screenshotDir: reports/screenshots`);
  }

  if (needsFlutterDesktop) {
    sections.push(`flutterDesktop:
  appPath: "\${project.basedir}/apps/mobile/build/macos/Build/Products/Profile/todoapp.app/Contents/MacOS/todoapp"
  defaultTimeoutMs: 10000
  launchTimeoutMs: 30000
  screenshotDir: reports/screenshots`);
  }

  return sections.join('\n') + '\n';
}
