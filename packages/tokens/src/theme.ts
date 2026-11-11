import { palette as p } from './palette.ts';

/** Semantic colour roles shared by mobile (React Native) and admin (CSS variables). */
export interface ColorRoles {
  bgCanvas: string;
  bgSurface: string;
  bgSunken: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  textOnAccent: string;
  textAccent: string;
  borderSubtle: string;
  borderControl: string;
  borderFocus: string;
  accent: string;
  accentPressed: string;
  accentSoft: string;
  /** Attendance tag states (signature component). */
  stateExpectedBg: string;
  stateExpectedFg: string;
  stateExpectedBorder: string;
  statePresentBg: string;
  statePresentFg: string;
  statePresentBorder: string;
  stateDepartedBg: string;
  stateDepartedFg: string;
  stateAbsentBg: string;
  stateAbsentFg: string;
  stateAbsentBorder: string;
  /** Feedback. */
  dangerBg: string;
  dangerFg: string;
  infoBg: string;
  infoFg: string;
  warningBg: string;
  warningFg: string;
  /** Inverse surface (snackbar). */
  inverseBg: string;
  inverseFg: string;
  inverseAction: string;
  /** Demo banner (synthetic data marker). */
  demoBg: string;
  demoFg: string;
}

export const light: ColorRoles = {
  bgCanvas: p.stone50,
  bgSurface: p.stone0,
  bgSunken: p.stone100,
  textPrimary: p.stone900,
  textSecondary: p.stone700,
  textTertiary: p.stone600,
  textOnAccent: p.stone0,
  textAccent: p.green700,
  borderSubtle: p.stone200,
  borderControl: p.stone500,
  borderFocus: p.green700,
  accent: p.green600,
  accentPressed: p.green700,
  accentSoft: p.green100,
  stateExpectedBg: p.stone0,
  stateExpectedFg: p.stone900,
  stateExpectedBorder: p.stone500,
  statePresentBg: p.green100,
  statePresentFg: p.green700,
  statePresentBorder: p.green600,
  stateDepartedBg: p.stone150,
  stateDepartedFg: p.stone700,
  stateAbsentBg: p.ochre100,
  stateAbsentFg: p.ochre700,
  stateAbsentBorder: p.ochre500,
  dangerBg: p.terra100,
  dangerFg: p.terra700,
  infoBg: p.slate100,
  infoFg: p.slate700,
  warningBg: p.ochre100,
  warningFg: p.ochre700,
  inverseBg: p.stone900,
  inverseFg: p.stone50,
  inverseAction: p.green300,
  demoBg: p.slate700,
  demoFg: p.stone0,
};

export const dark: ColorRoles = {
  bgCanvas: p.night900,
  bgSurface: p.night800,
  bgSunken: p.night700,
  textPrimary: p.nightText,
  textSecondary: p.nightMuted,
  textTertiary: p.nightSubtle,
  textOnAccent: p.night900,
  textAccent: p.green300,
  borderSubtle: p.night600,
  borderControl: p.night400,
  borderFocus: p.green300,
  accent: p.green300,
  accentPressed: p.onGreenContainerDark,
  accentSoft: p.greenContainerDark,
  stateExpectedBg: p.night800,
  stateExpectedFg: p.nightText,
  stateExpectedBorder: p.night400,
  statePresentBg: p.greenContainerDark,
  statePresentFg: p.onGreenContainerDark,
  statePresentBorder: p.green300,
  stateDepartedBg: p.night700,
  stateDepartedFg: p.nightMuted,
  stateAbsentBg: p.ochreContainerDark,
  stateAbsentFg: p.ochre300,
  stateAbsentBorder: p.ochre300,
  dangerBg: p.terraContainerDark,
  dangerFg: p.terra300,
  infoBg: p.slateContainerDark,
  infoFg: p.slate300,
  warningBg: p.ochreContainerDark,
  warningFg: p.ochre300,
  inverseBg: p.nightText,
  inverseFg: p.night900,
  inverseAction: p.green700,
  demoBg: p.slate300,
  demoFg: p.night900,
};

export const themes = { light, dark } as const;
export type ThemeName = keyof typeof themes;
