import { z } from 'zod';
import {
  FxAgentClient,
  FxAgentConnectionError,
  FxAgentProtocolError,
  DEFAULT_HOST,
  DEFAULT_PORT,
  type ElementNode,
} from './fxagent-client.js';

export const queryElementsInputSchema = z.object({
  selector: z.string().min(1).describe(
    'fxagent selector. Examples: #loginButton, .primary-button, text=Submit, ' +
    'TextField, css=VBox. Chain with >>.',
  ),
  host: z.string().default(DEFAULT_HOST),
  port: z.number().int().default(DEFAULT_PORT),
  maxResults: z.number().int().min(1).max(100).default(20),
});

export type QueryElementsInput = z.infer<typeof queryElementsInputSchema>;

function formatElement(el: ElementNode, index: number): string {
  const id = el.id ? `  id: #${el.id}` : '';
  const classes = el.styleClasses?.length
    ? `  classes: .${el.styleClasses.join(', .')}`
    : '';
  const elText =
    el.text !== null && el.text !== undefined ? `  text: "${el.text}"` : '';
  const bounds = el.bounds
    ? `  bounds: x=${Math.round(el.bounds.x)}, y=${Math.round(el.bounds.y)}, ` +
      `w=${Math.round(el.bounds.width)}, h=${Math.round(el.bounds.height)}`
    : '';
  const state = [
    el.visible ? 'visible' : 'hidden',
    el.enabled ? 'enabled' : 'disabled',
    el.focused ? 'focused' : '',
  ]
    .filter(Boolean)
    .join(', ');

  return [
    `[${index + 1}] ${el.type} (handle: ${el.handle})`,
    id,
    classes,
    elText,
    bounds,
    `  state: ${state}`,
  ]
    .filter((l) => l.trim().length > 0)
    .join('\n');
}

export async function queryElements(
  input: QueryElementsInput,
): Promise<{ content: [{ type: 'text'; text: string }] }> {
  const client = new FxAgentClient(input.host, input.port);

  try {
    const result = await client.queryElements(input.selector, input.maxResults);

    if (result.elements.length === 0) {
      return text(`No elements matched selector: "${input.selector}"`);
    }

    const header = `Found ${result.elements.length} element(s) for "${input.selector}":`;
    const body = result.elements.map(formatElement).join('\n\n');
    return text(`${header}\n\n${body}`);
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
