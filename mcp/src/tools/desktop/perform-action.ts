import { z } from 'zod';
import {
  FxAgentClient,
  FxAgentConnectionError,
  FxAgentProtocolError,
  DEFAULT_HOST,
  DEFAULT_PORT,
} from './fxagent-client.js';

const ACTIONS_REQUIRING_VALUE = ['fill', 'select', 'setText'] as const;

export const performActionInputSchema = z.object({
  selector: z.string().min(1).describe(
    'fxagent selector identifying the target element.',
  ),
  action: z
    .enum([
      'click',
      'dblclick',
      'rightclick',
      'hover',
      'fill',
      'clear',
      'select',
      'focus',
      'scroll',
      'setText',
    ])
    .describe('Action to perform on the element.'),
  value: z.string().optional().describe(
    'Required for fill, select, setText. The text or value to set.',
  ),
  host: z.string().default(DEFAULT_HOST),
  port: z.number().int().default(DEFAULT_PORT),
});

export type PerformActionInput = z.infer<typeof performActionInputSchema>;

export async function performAction(
  input: PerformActionInput,
): Promise<{ content: [{ type: 'text'; text: string }] }> {
  if (
    (ACTIONS_REQUIRING_VALUE as readonly string[]).includes(input.action) &&
    (input.value === undefined || input.value === '')
  ) {
    return text(
      `Error: action "${input.action}" requires a non-empty "value" parameter.`,
    );
  }

  const client = new FxAgentClient(input.host, input.port);

  try {
    const result = await client.performAction(input.selector, input.action, input.value);

    if (result.success) {
      const elementInfo = result.element
        ? ` (element: ${result.element.type}${result.element.id ? '#' + result.element.id : ''})`
        : '';
      return text(`Success: ${result.message}${elementInfo}`);
    }

    return text(`Failed: ${result.message}`);
  } catch (err) {
    const message =
      err instanceof FxAgentConnectionError || err instanceof FxAgentProtocolError
        ? err.message
        : String(err);
    return text(`Error: ${message}`);
  }
}

function text(t: string): { content: [{ type: 'text'; text: string }] } {
  return { content: [{ type: 'text' as const, text: t }] };
}
