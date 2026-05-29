/**
 * Templates for generating Maestro YAML flow files.
 */

/** Known Maestro command names for validation. */
export const KNOWN_MAESTRO_COMMANDS = new Set([
  'launchApp',
  'stopApp',
  'clearState',
  'clearKeychain',
  'tapOn',
  'longPressOn',
  'doubleTapOn',
  'pressKey',
  'inputText',
  'setText',
  'setClipboard',
  'pasteText',
  'hideKeyboard',
  'scroll',
  'scrollUntilVisible',
  'swipe',
  'assertVisible',
  'assertNotVisible',
  'assertTrue',
  'waitForAnimationToEnd',
  'takeScreenshot',
  'runFlow',
  'runScript',
  'evalScript',
  'travel',
  'repeat',
  'retry',
  'openLink',
  'extendedWaitUntil',
]);

export function renderMaestroFlowTemplate(
  appId: string,
  steps: readonly Record<string, unknown>[],
): string {
  const stepLines = steps
    .map((step) => {
      const entries = Object.entries(step);
      if (entries.length === 0) return '- # empty step';
      const [command, value] = entries[0];
      if (typeof value === 'string') {
        return `- ${command}: "${value}"`;
      }
      if (value === null || value === undefined) {
        return `- ${command}`;
      }
      // For complex values, render as nested YAML
      const valueLines = JSON.stringify(value, null, 2)
        .split('\n')
        .map((line, i) => (i === 0 ? '' : `    ${line}`))
        .join('\n');
      return `- ${command}: ${valueLines}`;
    })
    .join('\n');

  return `appId: ${appId}
---
${stepLines}
`;
}
