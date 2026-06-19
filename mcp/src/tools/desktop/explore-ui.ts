import { z } from 'zod';
import {
  FxAgentClient,
  FxAgentConnectionError,
  FxAgentProtocolError,
  DEFAULT_HOST,
  DEFAULT_PORT,
  type ElementNode,
  type SceneTreeResponse,
} from './fxagent-client.js';

export const exploreUiInputSchema = z.object({
  host: z.string().default(DEFAULT_HOST),
  port: z.number().int().default(DEFAULT_PORT),
  depth: z.number().int().min(1).max(10).default(5).describe(
    'Maximum tree depth to return (1–10). Default: 5.',
  ),
  selector: z.string().optional().describe(
    'Optional selector to scope the tree to a subtree. ' +
    'Returns the tree rooted at the first matching element.',
  ),
});

export type ExploreUiInput = z.infer<typeof exploreUiInputSchema>;

function renderNode(node: ElementNode, indent: number, maxDepth: number): string {
  if (indent > maxDepth) return '';
  const pad = '  '.repeat(indent);
  const id = node.id ? `#${node.id}` : '';
  const classes = node.styleClasses?.length
    ? '.' + node.styleClasses.join('.')
    : '';
  const nodeText = node.text ? ` "${node.text}"` : '';
  const hidden = node.visible ? '' : ' [hidden]';
  const disabled = node.enabled ? '' : ' [disabled]';
  const focused = node.focused ? ' [focused]' : '';
  const bounds = node.bounds
    ? ` @(${Math.round(node.bounds.x)},${Math.round(node.bounds.y)} ${Math.round(node.bounds.width)}x${Math.round(node.bounds.height)})`
    : '';

  let line = `${pad}${node.type}${id}${classes}${nodeText}${hidden}${disabled}${focused}${bounds}`;
  if (node.children?.length) {
    const childLines = node.children
      .map((child) => renderNode(child, indent + 1, maxDepth))
      .filter((l) => l.length > 0);
    if (childLines.length) line += '\n' + childLines.join('\n');
  }
  return line;
}

export async function exploreUi(
  input: ExploreUiInput,
): Promise<{ content: [{ type: 'text'; text: string }] }> {
  const client = new FxAgentClient(input.host, input.port);

  try {
    if (input.selector) {
      const queryResult = await client.queryElements(input.selector, 1);
      if (queryResult.elements.length === 0) {
        return text(`No element matched selector: "${input.selector}"`);
      }
      const handle = queryResult.elements[0].handle;
      const subtree = await client.getElementSubtree(handle, input.depth);
      return text(
        `Subtree for selector "${input.selector}" (depth ${input.depth}):\n\n` +
        renderNode(subtree, 0, input.depth),
      );
    }

    const tree: SceneTreeResponse = await client.getSceneTree(input.depth);
    const parts: string[] = [
      `Scene graph — ${tree.windows.length} window(s) (depth ${input.depth}):`,
    ];

    for (const win of tree.windows) {
      parts.push(`\n=== Window [${win.windowIndex}] ${win.windowType} ===`);
      const root = win.root as ElementNode | undefined;
      if (root && 'type' in root) {
        parts.push(renderNode(root, 0, input.depth));
      } else {
        parts.push('  (no scene root)');
      }
    }

    return text(parts.join('\n'));
  } catch (err) {
    if (err instanceof FxAgentConnectionError || err instanceof FxAgentProtocolError) {
      return text(`Error: ${err.message}`);
    }
    return text(`Error: ${String(err)}`);
  }
}

function text(t: string): { content: [{ type: 'text'; text: string }] } {
  return { content: [{ type: 'text' as const, text: t }] };
}
