/**
 * Templates for generating Cucumber step definition files.
 */

import * as ts from 'typescript';

export type StepType = 'Given' | 'When' | 'Then';

export interface StepInput {
  readonly type: StepType;
  readonly pattern: string;
  readonly body?: string;
  /**
   * Explicit parameter names — one per {string}/{int}/{float}/{word}/{bigdecimal}
   * placeholder, in order. The body should reference these identifiers.
   * If omitted, names default to value, value2, count, count2, ... which
   * usually mismatch what a hand-written body references.
   */
  readonly paramNames?: readonly string[];
}

interface ParamSpec {
  readonly name: string;
  readonly tsType: string;
}

/** Reserved JS/TS keywords and TS primitive type names — never treated as free identifiers. */
const RESERVED = new Set([
  'as', 'async', 'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
  'debugger', 'default', 'delete', 'do', 'else', 'export', 'extends', 'false',
  'finally', 'for', 'from', 'function', 'if', 'import', 'in', 'instanceof', 'is',
  'let', 'new', 'null', 'of', 'return', 'static', 'super', 'switch', 'this',
  'throw', 'true', 'try', 'typeof', 'undefined', 'var', 'void', 'while', 'with',
  'yield', 'any', 'unknown', 'never', 'object', 'string', 'number', 'boolean',
  'bigint', 'symbol',
]);

/** Common globals/builtins that should never be inferred as step params. */
const GLOBALS = new Set([
  'console', 'Math', 'Promise', 'Date', 'JSON', 'Object', 'Array', 'String',
  'Number', 'Boolean', 'Error', 'TypeError', 'RangeError', 'Symbol', 'Map',
  'Set', 'WeakMap', 'WeakSet', 'Buffer', 'process', 'globalThis', 'parseInt',
  'parseFloat', 'isNaN', 'isFinite', 'setTimeout', 'setInterval', 'fetch',
]);

/**
 * Determine whether an Identifier node sits in a "free reference" position
 * (i.e. its value will be looked up at runtime), as opposed to:
 *   - a declaration (variable, parameter, binding element, function/class name)
 *   - a property name in a member access (`obj.prop`)
 *   - a property key in an object literal or type (`{ key: value }`)
 *   - a label
 *   - a type reference / type parameter
 *
 * The shorthand `{ foo }` is a real reference — TypeScript exposes it as a
 * `ShorthandPropertyAssignment` whose `name` is the identifier. We treat that
 * as free.
 */
function isFreeReference(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (!parent) return true;

  // Declaration name positions — these are bindings, not references.
  if (
    (ts.isVariableDeclaration(parent) && parent.name === node) ||
    (ts.isParameter(parent) && parent.name === node) ||
    (ts.isBindingElement(parent) && parent.name === node) ||
    (ts.isFunctionDeclaration(parent) && parent.name === node) ||
    (ts.isFunctionExpression(parent) && parent.name === node) ||
    (ts.isArrowFunction(parent) && (parent as ts.ArrowFunction).name === node) ||
    (ts.isClassDeclaration(parent) && parent.name === node) ||
    (ts.isClassExpression(parent) && parent.name === node) ||
    (ts.isMethodDeclaration(parent) && parent.name === node) ||
    (ts.isPropertyDeclaration(parent) && parent.name === node) ||
    (ts.isGetAccessorDeclaration(parent) && parent.name === node) ||
    (ts.isSetAccessorDeclaration(parent) && parent.name === node) ||
    (ts.isEnumDeclaration(parent) && parent.name === node) ||
    (ts.isEnumMember(parent) && parent.name === node) ||
    (ts.isTypeAliasDeclaration(parent) && parent.name === node) ||
    (ts.isInterfaceDeclaration(parent) && parent.name === node) ||
    (ts.isTypeParameterDeclaration(parent) && parent.name === node) ||
    (ts.isCatchClause(parent) && parent.variableDeclaration?.name === node) ||
    (ts.isImportClause(parent) && parent.name === node) ||
    (ts.isImportSpecifier(parent) && parent.name === node) ||
    (ts.isNamespaceImport(parent) && parent.name === node)
  ) {
    return false;
  }

  // Property name in obj.prop — `prop` is not a free variable, it's a key.
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return false;
  // QualifiedName in type references: A.B — B is a member name.
  if (ts.isQualifiedName(parent) && parent.right === node) return false;

  // Property KEY in an object literal: { key: ... } — `key` is not a reference.
  if (ts.isPropertyAssignment(parent) && parent.name === node) return false;

  // ShorthandPropertyAssignment `{ foo }` — IS a reference (foo is read).
  // ts already places foo as parent.name; we WANT to return true here, so
  // do NOT add an exclusion for this case.

  // Property/method name in a TypeLiteral or InterfaceDeclaration body.
  if (ts.isPropertySignature(parent) && parent.name === node) return false;
  if (ts.isMethodSignature(parent) && parent.name === node) return false;

  // Label position (e.g. `outer:`).
  if (ts.isLabeledStatement(parent) && parent.label === node) return false;
  if ((ts.isBreakStatement(parent) || ts.isContinueStatement(parent)) && parent.label === node) {
    return false;
  }

  // JSX attribute names.
  if (ts.isJsxAttribute(parent) && parent.name === node) return false;

  return true;
}

/**
 * Extract free identifier names from a step-definition body using the
 * TypeScript parser. "Free" means: read in an expression position, not
 * declared inside the body, not a property name, not a known global, not a
 * capitalized identifier (assumed to be a type or class).
 *
 * Returns identifiers in order of first appearance. Returns null if fewer
 * than `expected` candidates are found.
 *
 * This replaces the earlier regex-based heuristic — that approach mistakenly
 * picked property keys (`{ email: ... }` → "email") and missed identifiers
 * inside template-literal interpolations.
 */
function extractFreeIdentifiersFromBody(body: string, expected: number): string[] | null {
  if (expected === 0) return [];

  // Wrap the body in an async function so top-level `await` and `this`
  // refer to a valid lexical context for the parser. The wrapper's own
  // name is excluded from results below.
  const wrapped = `async function __conductorStepBody__(this: any) {\n${body}\n}`;
  const source = ts.createSourceFile(
    '__step_body__.ts',
    wrapped,
    ts.ScriptTarget.ES2022,
    /*setParentNodes*/ true,
    ts.ScriptKind.TS,
  );

  // First pass: gather every identifier declared inside the body so we don't
  // mistake a local for a free reference. This includes const/let/var,
  // function params, destructuring binding elements, catch clause vars,
  // function declarations, class declarations.
  const declared = new Set<string>(['__conductorStepBody__']);
  function collectDecls(node: ts.Node) {
    if (
      (ts.isVariableDeclaration(node) ||
        ts.isParameter(node) ||
        ts.isBindingElement(node) ||
        ts.isFunctionDeclaration(node) ||
        ts.isClassDeclaration(node)) &&
      node.name &&
      ts.isIdentifier(node.name)
    ) {
      declared.add(node.name.text);
    }
    if (
      ts.isCatchClause(node) &&
      node.variableDeclaration?.name &&
      ts.isIdentifier(node.variableDeclaration.name)
    ) {
      declared.add(node.variableDeclaration.name.text);
    }
    ts.forEachChild(node, collectDecls);
  }
  collectDecls(source);

  // Second pass: collect free references in order.
  const seen = new Set<string>();
  const free: string[] = [];
  function collectRefs(node: ts.Node) {
    if (ts.isIdentifier(node)) {
      const name = node.text;
      if (
        isFreeReference(node) &&
        !RESERVED.has(name) &&
        !GLOBALS.has(name) &&
        !/^[A-Z]/.test(name) && // assume types/classes
        !declared.has(name) &&
        !seen.has(name)
      ) {
        seen.add(name);
        free.push(name);
      }
    }
    ts.forEachChild(node, collectRefs);
  }
  collectRefs(source);

  return free.length >= expected ? free.slice(0, expected) : null;
}

/**
 * Infer TypeScript parameter names and types from a Cucumber expression pattern.
 *
 * Resolution order:
 *   1. Explicit `paramNames` (per StepInput) — paired positionally with placeholders.
 *   2. Identifiers extracted from `body` — paired positionally if enough are found.
 *   3. Generic positional names (value, value2, count, count2, ...) — last resort.
 *
 * Step 2 lets the scaffolder succeed even when the caller forgets to pass
 * paramNames but the body references identifier names like `email`, `path`,
 * `expected` — the most common AI failure mode reported in dogfood.
 */
function inferParams(
  pattern: string,
  paramNames?: readonly string[],
  body?: string,
): ParamSpec[] {
  const types: Array<{ tsType: string; defaultBase: string }> = [];
  const paramRegex = /\{(string|int|float|word|bigdecimal)\}/g;
  let match: RegExpExecArray | null;

  while ((match = paramRegex.exec(pattern)) !== null) {
    const cucumberType = match[1];
    const tsType = cucumberType === 'int' || cucumberType === 'float' ? 'number' : 'string';
    const defaultBase = tsType === 'number' ? 'count' : 'value';
    types.push({ tsType, defaultBase });
  }

  // 1. Explicit paramNames win.
  if (paramNames && paramNames.length > 0) {
    if (paramNames.length !== types.length) {
      throw new Error(
        `paramNames length (${paramNames.length}) does not match placeholder count (${types.length}) in pattern "${pattern}". ` +
          `Provide one name per {string}/{int}/{float}/{word}/{bigdecimal} placeholder, in order.`,
      );
    }
    return types.map((t, i) => ({ name: paramNames[i]!, tsType: t.tsType }));
  }

  // 2. Body-extracted free identifiers, in order of appearance.
  if (body && types.length > 0) {
    const inferred = extractFreeIdentifiersFromBody(body, types.length);
    if (inferred !== null) {
      return types.map((t, i) => ({ name: inferred[i]!, tsType: t.tsType }));
    }
  }

  // 3. Generic positional names (last resort — almost certainly mismatches a body).
  const counters: Record<string, number> = {};
  return types.map(({ tsType, defaultBase }) => {
    const n = (counters[defaultBase] ?? 0) + 1;
    counters[defaultBase] = n;
    return { name: n === 1 ? defaultBase : `${defaultBase}${n}`, tsType };
  });
}

function renderStepFunction(step: StepInput): string {
  const params = inferParams(step.pattern, step.paramNames, step.body);
  const paramList = params.map((p) => `${p.name}: ${p.tsType}`).join(', ');
  const separator = paramList ? ', ' : '';
  const body = step.body?.trim() ?? '// TODO: implement step';

  // JSON.stringify wraps the pattern in a properly-escaped JS string literal —
  // handles single quotes in patterns like "I don't see {string}" without breaking.
  return `${step.type}(${JSON.stringify(step.pattern)}, async function (this: ConductorWorld${separator}${paramList}) {
  ${body}
});`;
}

export function renderStepDefTemplate(
  platform: string,
  steps: readonly StepInput[],
): string {
  const stepFunctions = steps.map(renderStepFunction).join('\n\n');

  return `import { Given, When, Then } from '@cucumber/cucumber';
import { ConductorWorld } from 'conductor-e2e';

${stepFunctions}
`;
}

/**
 * Append new step definitions to existing file content.
 * Avoids duplicating existing patterns.
 */
export function appendStepsToExistingContent(
  existingContent: string,
  steps: readonly StepInput[],
): string {
  const newSteps = steps.filter((step) => {
    // Skip if pattern already exists in the file
    const escaped = step.pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return !new RegExp(escaped).test(existingContent);
  });

  if (newSteps.length === 0) {
    return existingContent;
  }

  const additions = newSteps.map(renderStepFunction).join('\n\n');
  return `${existingContent.trimEnd()}\n\n${additions}\n`;
}
