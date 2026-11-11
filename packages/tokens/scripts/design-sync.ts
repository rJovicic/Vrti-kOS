// Keeps DESIGN.md frontmatter and the design prototype stylesheet generated from the token source,
// so there is exactly one source of truth (packages/tokens). Run: pnpm design:sync
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { toCss } from '../src/css.ts';
import { dark, light } from '../src/theme.ts';
import { radius, space, type, fontStack } from '../src/scale.ts';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const kebab = (s: string) => s.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);

const lines: string[] = [
  '---',
  'name: VrtićOS',
  'description: Mirna, topla i pouzdana platforma za vrtiće — zid garderobe kao svakodnevni registar.',
  'colors:',
  ...Object.entries(light).map(([k, v]) => `  ${kebab(k)}: "${v}"`),
  ...Object.entries(dark).map(([k, v]) => `  dark-${kebab(k)}: "${v}"`),
  'typography:',
  ...Object.entries(type).flatMap(([k, t]) => [
    `  ${kebab(k)}:`,
    `    fontFamily: "${fontStack.web.replaceAll('"', "'")}"`,
    `    fontSize: "${t.size}px"`,
    `    fontWeight: ${t.weight}`,
    `    lineHeight: "${t.lineHeight}px"`,
    ...('tracking' in t ? [`    letterSpacing: "${t.tracking}px"`] : []),
  ]),
  'rounded:',
  ...Object.entries(radius).map(([k, v]) => `  ${k}: "${v}px"`),
  'spacing:',
  ...Object.entries(space).map(([k, v]) => `  s${k}: "${v}px"`),
  'components:',
  '  button-primary:',
  '    backgroundColor: "{colors.accent}"',
  '    textColor: "{colors.text-on-accent}"',
  '    rounded: "{rounded.md}"',
  '    height: "48px"',
  '  button-primary-pressed:',
  '    backgroundColor: "{colors.accent-pressed}"',
  '  attendance-tag-expected:',
  '    backgroundColor: "{colors.state-expected-bg}"',
  '    textColor: "{colors.state-expected-fg}"',
  '    rounded: "{rounded.tag}"',
  '    height: "72px"',
  '  attendance-tag-present:',
  '    backgroundColor: "{colors.state-present-bg}"',
  '    textColor: "{colors.state-present-fg}"',
  '    rounded: "{rounded.tag}"',
  '  attendance-tag-departed:',
  '    backgroundColor: "{colors.state-departed-bg}"',
  '    textColor: "{colors.state-departed-fg}"',
  '    rounded: "{rounded.tag}"',
  '  attendance-tag-absent:',
  '    backgroundColor: "{colors.state-absent-bg}"',
  '    textColor: "{colors.state-absent-fg}"',
  '    rounded: "{rounded.tag}"',
  '---',
];

const designPath = join(root, 'DESIGN.md');
const body = readFileSync(designPath, 'utf8').replace(/^---\n[\s\S]*?\n---\n/, '');
writeFileSync(designPath, `${lines.join('\n')}\n${body}`);

const protoCss = join(root, 'design', 'prototype', 'tokens.css');
mkdirSync(dirname(protoCss), { recursive: true });
writeFileSync(protoCss, toCss());
console.log('DESIGN.md frontmatter and design/prototype/tokens.css regenerated');

