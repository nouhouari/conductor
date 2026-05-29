/**
 * Templates for generating Page Object classes that extend BasePage.
 */

export interface LocatorInput {
  readonly name: string;
  readonly selector: string;
}

export interface MethodInput {
  readonly name: string;
  readonly signature: string;
  /**
   * Optional implementation body. If omitted, the method gets a TODO stub.
   * The body is inserted between the method's `{` and `}` and is indented for
   * you — write the body as if you were writing it inside the function.
   */
  readonly body?: string;
}

/** Extract the return type (text after the last ': ' before '{') from a signature. */
function extractReturnType(signature: string): string | null {
  const trimmed = signature.trim();
  // Strip a leading 'async ' if present so it doesn't confuse the regex.
  const noAsync = trimmed.replace(/^async\s+/, '');
  // Look for `<name>(...): <type>` — find the matched parens, then any colon after.
  let depth = 0;
  let parenEnd = -1;
  for (let i = 0; i < noAsync.length; i++) {
    if (noAsync[i] === '(') depth++;
    else if (noAsync[i] === ')') {
      depth--;
      if (depth === 0) {
        parenEnd = i;
        break;
      }
    }
  }
  if (parenEnd === -1) return null;
  const rest = noAsync.slice(parenEnd + 1).trim();
  if (!rest.startsWith(':')) return null;
  return rest.slice(1).trim();
}

/** A return type is async-compatible when it's Promise<...> or absent/void. */
function isAsyncCompatible(returnType: string | null): boolean {
  if (returnType === null) return true; // no return type → we add Promise<void>
  const t = returnType.replace(/\s+/g, '');
  return t.startsWith('Promise<') || t === 'void';
}

export function renderPageObjectTemplate(
  className: string,
  locators: readonly LocatorInput[],
  methods: readonly MethodInput[],
): string {
  const locatorDeclarations = locators
    .map((l) => `  private readonly ${l.name}: Locator;`)
    .join('\n');

  const locatorInitializations = locators
    .map((l) => `    this.${l.name} = this.page.locator('${l.selector}');`)
    .join('\n');

  const methodBodies = methods
    .map((m) => {
      const sig = m.signature.trim();
      const declaredAsync = /^async\s+/.test(sig);
      const returnType = extractReturnType(sig);
      const asyncOk = isAsyncCompatible(returnType);

      // Only prepend `async ` when (a) not already declared, AND (b) the return
      // type is async-compatible. Adding `async` to a method that returns a
      // synchronous value like Locator produces TS2326 (An async function or
      // method must return a Promise).
      const prefix = declaredAsync || !asyncOk ? '' : 'async ';
      const returnSuffix = returnType === null ? ': Promise<void>' : '';

      const rawBody = m.body?.trim();
      const bodyText = rawBody && rawBody.length > 0 ? rawBody : `// TODO: implement ${m.name}`;
      const indentedBody = bodyText
        .split('\n')
        .map((line) => (line ? `    ${line}` : ''))
        .join('\n');

      return `  ${prefix}${sig}${returnSuffix} {\n${indentedBody}\n  }`;
    })
    .join('\n\n');

  const hasLocators = locators.length > 0;
  const hasMethods = methods.length > 0;

  const constructorBody = hasLocators
    ? `\n  constructor(...args: ConstructorParameters<typeof BasePage>) {\n    super(...args);\n${locatorInitializations}\n  }`
    : '';

  const sections: string[] = [];
  if (hasLocators) sections.push(locatorDeclarations);
  if (constructorBody) sections.push(constructorBody);
  if (hasMethods) sections.push(methodBodies);

  const classBody = sections.join('\n\n');

  return `import { BasePage } from 'conductor-e2e';
import type { Locator } from 'playwright';

export class ${className} extends BasePage {
${classBody}
}
`;
}
