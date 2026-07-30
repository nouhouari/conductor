/**
 * Templates for generating Cucumber-JVM step definition classes.
 *
 * The Java flavour differs from the TypeScript one in three ways:
 *   - steps are annotated methods on a class, not top-level calls;
 *   - the World is injected through the constructor (PicoContainer), not `this`;
 *   - method names must be derived from the pattern and be unique in the class.
 */

import type { StepInput, StepType } from './step-def.js';

export type { StepInput, StepType };

interface JavaParamSpec {
  readonly name: string;
  readonly javaType: string;
}

/** Java keywords that can never be used as an identifier. */
const JAVA_RESERVED = new Set([
  'abstract', 'assert', 'boolean', 'break', 'byte', 'case', 'catch', 'char',
  'class', 'const', 'continue', 'default', 'do', 'double', 'else', 'enum',
  'extends', 'final', 'finally', 'float', 'for', 'goto', 'if', 'implements',
  'import', 'instanceof', 'int', 'interface', 'long', 'native', 'new',
  'package', 'private', 'protected', 'public', 'return', 'short', 'static',
  'strictfp', 'super', 'switch', 'synchronized', 'this', 'throw', 'throws',
  'transient', 'try', 'void', 'volatile', 'while', 'var', 'record', 'yield',
]);

const CUCUMBER_TO_JAVA: Record<string, string> = {
  string: 'String',
  int: 'Integer',
  float: 'Double',
  word: 'String',
  bigdecimal: 'java.math.BigDecimal',
};

/** Escape a pattern for use inside a Java double-quoted string literal. */
export function javaStringLiteral(value: string): string {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
  return `"${escaped}"`;
}

function sanitizeIdentifier(name: string, fallback: string): string {
  const cleaned = name.replace(/[^A-Za-z0-9_]/g, '');
  if (cleaned.length === 0 || /^[0-9]/.test(cleaned)) return fallback;
  return JAVA_RESERVED.has(cleaned) ? `${cleaned}Value` : cleaned;
}

/**
 * Derive a camelCase method name from a Cucumber expression, dropping the
 * placeholders — mirrors the convention in the Java example project
 * (`"I log in as {string} with password {string}"` → `iLogInAsWithPassword`).
 */
export function methodNameFromPattern(pattern: string, type: StepType): string {
  const words = pattern
    .replace(/\{[^}]*\}/g, ' ')
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);

  if (words.length === 0) return type.toLowerCase();

  const name = words
    .map((word, index) =>
      index === 0
        ? word.charAt(0).toLowerCase() + word.slice(1)
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join('');

  return sanitizeIdentifier(name, type.toLowerCase());
}

/** Pair each placeholder in the pattern with a Java type and parameter name. */
function inferJavaParams(pattern: string, paramNames?: readonly string[]): JavaParamSpec[] {
  const types: string[] = [];
  const paramRegex = /\{(string|int|float|word|bigdecimal)\}/g;
  let match: RegExpExecArray | null;
  while ((match = paramRegex.exec(pattern)) !== null) {
    types.push(CUCUMBER_TO_JAVA[match[1] as string] ?? 'String');
  }

  if (paramNames && paramNames.length > 0) {
    if (paramNames.length !== types.length) {
      throw new Error(
        `paramNames length (${paramNames.length}) does not match placeholder count (${types.length}) in pattern "${pattern}". ` +
          `Provide one name per {string}/{int}/{float}/{word}/{bigdecimal} placeholder, in order.`,
      );
    }
    return types.map((javaType, i) => ({
      name: sanitizeIdentifier(paramNames[i] as string, `arg${i + 1}`),
      javaType,
    }));
  }

  const counters: Record<string, number> = {};
  return types.map((javaType) => {
    const base = javaType === 'String' ? 'value' : 'count';
    const n = (counters[base] ?? 0) + 1;
    counters[base] = n;
    return { name: n === 1 ? base : `${base}${n}`, javaType };
  });
}

function renderStepMethod(step: StepInput, usedNames: Set<string>): string {
  const params = inferJavaParams(step.pattern, step.paramNames);
  const paramList = params.map((p) => `${p.javaType} ${p.name}`).join(', ');

  let methodName = methodNameFromPattern(step.pattern, step.type);
  let suffix = 2;
  while (usedNames.has(methodName)) {
    methodName = `${methodNameFromPattern(step.pattern, step.type)}${suffix++}`;
  }
  usedNames.add(methodName);

  const body = (step.body?.trim() ?? '// TODO: implement step')
    .split('\n')
    .map((line) => (line.trim().length === 0 ? '' : `        ${line}`))
    .join('\n');

  return `    @${step.type}(${javaStringLiteral(step.pattern)})
    public void ${methodName}(${paramList}) {
${body}
    }`;
}

/** Convert a file base name into a Java class name, e.g. `web` → `WebSteps`. */
export function javaStepClassName(name: string): string {
  const base = name.replace(/\.java$/, '').replace(/\.steps$/i, '');
  const camel = base
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w.length > 0)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join('');
  const className = camel.length > 0 ? camel : 'Generated';
  return className.endsWith('Steps') ? className : `${className}Steps`;
}

export interface JavaStepDefOptions {
  readonly packageName: string;
  readonly className: string;
  readonly platform: string;
}

export function renderJavaStepDefTemplate(
  options: JavaStepDefOptions,
  steps: readonly StepInput[],
): string {
  const usedNames = new Set<string>();
  const methods = steps.map((step) => renderStepMethod(step, usedNames)).join('\n\n');
  const packageLine = options.packageName ? `package ${options.packageName};\n\n` : '';

  return `${packageLine}import com.nouhouari.conductor.world.ConductorWorld;
import io.cucumber.java.en.Given;
import io.cucumber.java.en.Then;
import io.cucumber.java.en.When;

/** ${options.platform} step definitions. */
public class ${options.className} {

    private final ConductorWorld world;

    public ${options.className}(ConductorWorld world) {
        this.world = world;
    }

${methods}
}
`;
}

/**
 * Append new step methods to an existing Java step-definition class, skipping
 * patterns that are already present. Inserts before the class's closing brace.
 */
export function appendJavaStepsToExistingContent(
  existingContent: string,
  steps: readonly StepInput[],
): string {
  const newSteps = steps.filter((step) => !existingContent.includes(javaStringLiteral(step.pattern)));
  if (newSteps.length === 0) return existingContent;

  const usedNames = new Set<string>();
  for (const match of existingContent.matchAll(/public\s+void\s+(\w+)\s*\(/g)) {
    if (match[1]) usedNames.add(match[1]);
  }

  const additions = newSteps.map((step) => renderStepMethod(step, usedNames)).join('\n\n');
  const trimmed = existingContent.trimEnd();
  const lastBrace = trimmed.lastIndexOf('}');
  if (lastBrace === -1) return `${trimmed}\n\n${additions}\n`;

  return `${trimmed.slice(0, lastBrace).trimEnd()}\n\n${additions}\n}\n`;
}
