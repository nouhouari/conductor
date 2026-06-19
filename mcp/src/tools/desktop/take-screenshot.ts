import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import {
  FxAgentClient,
  FxAgentConnectionError,
  FxAgentProtocolError,
  DEFAULT_HOST,
  DEFAULT_PORT,
} from './fxagent-client.js';

export const takeScreenshotInputSchema = z.object({
  host: z.string().default(DEFAULT_HOST),
  port: z.number().int().default(DEFAULT_PORT),
  selector: z.string().optional().describe(
    'Capture a specific element instead of the full window.',
  ),
  windowIndex: z.number().int().min(0).optional().describe(
    'Capture a specific window (0-based index). Defaults to window 0.',
  ),
  savePath: z.string().optional().describe(
    'Absolute or relative path where the PNG should be saved. ' +
    'When omitted, the image is returned as inline MCP image content.',
  ),
});

export type TakeScreenshotInput = z.infer<typeof takeScreenshotInputSchema>;

type TextContent = { type: 'text'; text: string };
type ImageContent = { type: 'image'; data: string; mimeType: 'image/png' };
type ToolResult = { content: Array<TextContent | ImageContent> };

export async function takeScreenshot(input: TakeScreenshotInput): Promise<ToolResult> {
  const client = new FxAgentClient(input.host, input.port);

  try {
    const response = await client.captureScreenshot({
      selector: input.selector,
      windowIndex: input.windowIndex,
    });

    if (input.savePath) {
      const absPath = path.resolve(input.savePath);
      await fs.mkdir(path.dirname(absPath), { recursive: true });
      const buffer = Buffer.from(response.data, 'base64');
      await fs.writeFile(absPath, buffer);
      return {
        content: [{
          type: 'text' as const,
          text: `Screenshot saved to: ${absPath} (${response.width}x${response.height} PNG)`,
        }],
      };
    }

    return {
      content: [{
        type: 'image' as const,
        data: response.data,
        mimeType: 'image/png' as const,
      }],
    };
  } catch (err) {
    const message =
      err instanceof FxAgentConnectionError || err instanceof FxAgentProtocolError
        ? err.message
        : String(err);
    return { content: [{ type: 'text' as const, text: `Error: ${message}` }] };
  }
}
