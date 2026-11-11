import { describe, expect, it } from 'vitest';
import { contrastRatio } from './contrast.ts';
import { themes, type ColorRoles } from './theme.ts';

type Pair = [fg: keyof ColorRoles, bg: keyof ColorRoles, min: number];

// Text pairs need 4.5:1 (WCAG 1.4.3); control boundaries and state borders need 3:1 (WCAG 1.4.11).
const pairs: Pair[] = [
  ['textPrimary', 'bgCanvas', 4.5],
  ['textPrimary', 'bgSurface', 4.5],
  ['textPrimary', 'bgSunken', 4.5],
  ['textSecondary', 'bgCanvas', 4.5],
  ['textSecondary', 'bgSurface', 4.5],
  ['textSecondary', 'bgSunken', 4.5],
  ['textTertiary', 'bgCanvas', 4.5],
  ['textTertiary', 'bgSurface', 4.5],
  ['textTertiary', 'bgSunken', 4.5],
  ['textAccent', 'bgSurface', 4.5],
  ['textAccent', 'bgCanvas', 4.5],
  ['textOnAccent', 'accent', 4.5],
  ['textOnAccent', 'accentPressed', 4.5],
  ['stateExpectedFg', 'stateExpectedBg', 4.5],
  ['statePresentFg', 'statePresentBg', 4.5],
  ['stateDepartedFg', 'stateDepartedBg', 4.5],
  ['stateAbsentFg', 'stateAbsentBg', 4.5],
  ['dangerFg', 'dangerBg', 4.5],
  ['infoFg', 'infoBg', 4.5],
  ['warningFg', 'warningBg', 4.5],
  ['demoFg', 'demoBg', 4.5],
  ['inverseFg', 'inverseBg', 4.5],
  ['inverseAction', 'inverseBg', 4.5],
  ['borderControl', 'bgSurface', 3],
  ['borderControl', 'bgCanvas', 3],
  ['borderFocus', 'bgSurface', 3],
  ['borderFocus', 'bgCanvas', 3],
  ['stateExpectedBorder', 'bgSurface', 3],
  ['statePresentBorder', 'bgSurface', 3],
  ['stateAbsentBorder', 'bgSurface', 3],
];

describe.each(Object.entries(themes))('%s theme contrast', (_name, roles) => {
  it.each(pairs)('%s on %s ≥ %s:1', (fg, bg, min) => {
    expect(contrastRatio(roles[fg], roles[bg])).toBeGreaterThanOrEqual(min);
  });
});
