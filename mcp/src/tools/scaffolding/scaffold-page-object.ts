/**
 * scaffold_page_object: Create a page object class extending BasePage.
 *
 * Writes pages/<Name>Page.ts. Refuses to overwrite unless overwrite=true.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { z } from 'zod';
import type { ProjectPaths } from '../../project.js';
import { javaPackageForDir } from '../../java-project.js';
import { renderPageObjectTemplate } from '../../templates/artifact/page-object.js';
import {
  javaPageClassName,
  renderJavaPageObjectTemplate,
} from '../../templates/artifact/page-object-java.js';

export const scaffoldPageObjectInputSchema = z.object({
  name: z
    .string()
    .min(1)
    .describe("Page/class name without 'Page' suffix, e.g. 'Login' → 'LoginPage.ts'."),
  locators: z
    .array(
      z.object({
        name: z.string().describe("Property name for the locator, e.g. 'usernameInput'."),
        selector: z.string().describe("Playwright selector string, e.g. '[data-testid=\"username\"]'."),
      }),
    )
    .default([])
    .describe("Private locator fields to declare in the constructor."),
  methods: z
    .array(
      z.object({
        name: z.string().describe("Method name."),
        signature: z.string().describe(
          "Full method signature starting from the method name, e.g. 'login(email: string, password: string): Promise<void>'. " +
            "Prefix 'async ' for async functions. " +
            'For Locator-returning helpers, declare the return type explicitly (e.g. `errorMessage(): Locator`) — ' +
            'the scaffolder will skip the implicit `async` so the file compiles. ' +
            "In a Java project, write the Java signature instead, e.g. 'void login(String email, String password)' " +
            '(a missing return type defaults to void).',
        ),
        body: z
          .string()
          .optional()
          .describe(
            'Optional method body (TypeScript, or Java in a Java project). Written as-is between { and }, indented for you. ' +
              'Omit to get a `// TODO: implement <name>` stub.',
          ),
      }),
    )
    .default([])
    .describe(
      'Public methods to add. Pass `body` to ship a working implementation; omit it for a stub.',
    ),
  overwrite: z
    .boolean()
    .default(false)
    .describe("Overwrite if the file already exists. Default: false."),
  projectPath: z.string().optional().describe(
    'Optional absolute path to the Conductor project root (containing cucumber.js). ' +
      'When omitted, auto-discovered. Pass this in monorepos where the heuristics fail.',
  ),
});

export type ScaffoldPageObjectInput = z.infer<typeof scaffoldPageObjectInputSchema>;

export interface ScaffoldPageObjectResult {
  readonly path: string;
  readonly content: string;
  readonly created: boolean;
}

export async function scaffoldPageObject(
  paths: ProjectPaths,
  input: ScaffoldPageObjectInput,
): Promise<ScaffoldPageObjectResult> {
  // Ensure the class name ends with 'Page' and the file is named accordingly
  const isJava = paths.language === 'java';
  const baseName = input.name.endsWith('Page') ? input.name : `${input.name}Page`;
  const className = isJava ? javaPageClassName(baseName) : baseName;
  const fileName = `${className}${isJava ? '.java' : '.ts'}`;
  const filePath = path.join(paths.pages, fileName);
  const content = isJava
    ? renderJavaPageObjectTemplate(
        { packageName: javaPackageForDir(paths.javaModule ?? paths.root, paths.pages), className },
        input.locators,
        input.methods,
      )
    : renderPageObjectTemplate(className, input.locators, input.methods);

  // Check existence
  try {
    await fs.access(filePath);
    if (!input.overwrite) {
      throw new Error(
        `File already exists at "${filePath}". Pass overwrite: true to replace it.`,
      );
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }

  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content, 'utf8');

  return {
    path: filePath,
    content,
    created: true,
  };
}
