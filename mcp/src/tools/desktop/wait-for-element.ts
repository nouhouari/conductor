import { z } from 'zod';
import {
  FxAgentClient,
  FxAgentConnectionError,
  FxAgentProtocolError,
  DEFAULT_HOST,
  DEFAULT_PORT,
  type ElementNode,
} from './fxagent-client.js';

export const waitForElementInputSchema = z.object({
  selector: z.string().min(1).describe(
    'fxagent selector for the element to wait for.',
  ),
  state: z
    .enum(['visible', 'hidden', 'enabled', 'exists'])
    .describe(
      'Condition to wait for. "exists" waits for the element to appear in the scene graph.',
    ),
  timeoutMs: z.number().int().min(100).default(5000).describe(
    'Maximum time to wait in milliseconds. Default: 5000.',
  ),
  host: z.string().default(DEFAULT_HOST),
  port: z.number().int().default(DEFAULT_PORT),
});

export type WaitForElementInput = z.infer<typeof waitForElementInputSchema>;

function formatFoundElement(el: ElementNode): string {
  const id = el.id ? `#${el.id}` : '';
  const classes = el.styleClasses?.length ? `.${el.styleClasses.join('.')}` : '';
  const elText = el.text ? ` "${el.text}"` : '';
  const state = [
    el.visible ? 'visible' : 'hidden',
    el.enabled ? 'enabled' : 'disabled',
  ].join(', ');
  return `${el.type}${id}${classes}${elText} — ${state} (handle: ${el.handle})`;
}

export async function waitForElement(
  input: WaitForElementInput,
): Promise<{ content: [{ type: 'text'; text: string }] }> {
  const client = new FxAgentClient(input.host, input.port);
  const start = Date.now();

  try {
    const element = await client.waitForElement(
      input.selector,
      input.state,
      input.timeoutMs,
    );

    const elapsed = Date.now() - start;
    return text(
      `Element reached state "${input.state}" after ${elapsed}ms:\n` +
      formatFoundElement(element),
    );
  } catch (err) {
    const elapsed = Date.now() - start;
    if (err instanceof FxAgentProtocolError) {
      return text(
        `Timeout: "${input.selector}" did not reach state "${input.state}" ` +
        `within ${input.timeoutMs}ms (elapsed: ${elapsed}ms). ${err.message}`,
      );
    }
    if (err instanceof FxAgentConnectionError) {
      return text(`Error: ${err.message}`);
    }
    return text(`Error: ${String(err)}`);
  }
}

function text(t: string): { content: [{ type: 'text'; text: string }] } {
  return { content: [{ type: 'text' as const, text: t }] };
}
