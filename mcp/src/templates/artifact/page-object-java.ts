/**
 * Templates for generating Java Page Object classes that extend BasePage.
 *
 * Mirrors templates/artifact/page-object.ts. Locators are `Locator` fields
 * initialised in a `(Page page, EnvironmentConfig config)` constructor, which
 * is the shape the Java `BasePage` exposes.
 */

import { javaStringLiteral } from './step-def-java.js';

export interface JavaLocatorInput {
  readonly name: string;
  readonly selector: string;
}

export interface JavaMethodInput {
  /** Method name — used for the TODO stub and for de-duplication. */
  readonly name: string;
  /**
   * Full Java signature without modifiers or braces, e.g.
   * `void login(String user, String password)` or `Locator row(String title)`.
   * A missing return type defaults to `void`.
   */
  readonly signature: string;
  readonly body?: string;
}

/** Convert an arbitrary name into a PascalCase Java class name. */
export function javaPageClassName(name: string): string {
  const base = name.replace(/\.java$/, '');
  const camel = base
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  return camel.length > 0 ? camel : 'GeneratedPage';
}

/** Does the signature already start with a return type (as opposed to a bare name)? */
function normalizeSignature(signature: string): string {
  const trimmed = signature.trim().replace(/[;{]\s*$/, '');
  // A signature is `returnType name(params)`; if there's no whitespace before
  // the opening paren, the return type was omitted.
  const parenIndex = trimmed.indexOf('(');
  const head = parenIndex === -1 ? trimmed : trimmed.slice(0, parenIndex);
  return /\s/.test(head.trim()) ? trimmed : `void ${trimmed}`;
}

export interface JavaPageObjectOptions {
  readonly packageName: string;
  readonly className: string;
}

export function renderJavaPageObjectTemplate(
  options: JavaPageObjectOptions,
  locators: readonly JavaLocatorInput[],
  methods: readonly JavaMethodInput[],
): string {
  const { packageName, className } = options;

  const fields = locators.map((l) => `    private final Locator ${l.name};`).join('\n');

  const assignments = locators
    .map((l) => `        this.${l.name} = page.locator(${javaStringLiteral(l.selector)});`)
    .join('\n');

  const constructor = `    public ${className}(Page page, EnvironmentConfig config) {
        super(page, config);${assignments ? `\n${assignments}` : ''}
    }`;

  const methodBodies = methods
    .map((m) => {
      const signature = normalizeSignature(m.signature);
      const raw = m.body?.trim();
      const bodyText = raw && raw.length > 0 ? raw : `// TODO: implement ${m.name}`;
      const indented = bodyText
        .split('\n')
        .map((line) => (line.trim().length === 0 ? '' : `        ${line}`))
        .join('\n');
      return `    public ${signature} {\n${indented}\n    }`;
    })
    .join('\n\n');

  const sections: string[] = [];
  if (fields) sections.push(fields);
  sections.push(constructor);
  if (methodBodies) sections.push(methodBodies);

  const packageLine = packageName ? `package ${packageName};\n\n` : '';
  const locatorImport = locators.length > 0 ? 'import com.microsoft.playwright.Locator;\n' : '';

  return `${packageLine}${locatorImport}import com.microsoft.playwright.Page;
import com.nouhouari.conductor.config.EnvironmentConfig;
import com.nouhouari.conductor.pages.BasePage;

public class ${className} extends BasePage {

${sections.join('\n\n')}
}
`;
}
