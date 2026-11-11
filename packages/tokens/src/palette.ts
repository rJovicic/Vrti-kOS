/**
 * Raw palette. Never referenced by app code directly — use the semantic roles in `theme.ts`.
 * World: kindergarten cloakroom wall (birch plywood neutrals, painted soft green, ochre, terra rossa).
 * Every value used for text or control boundaries is contrast-checked in `contrast.test.ts`.
 */
export const palette = {
  stone0: '#FFFFFF',
  stone50: '#F6F5F1',
  stone100: '#EEECE6',
  stone150: '#ECEAE4',
  stone200: '#DCD8CE',
  stone500: '#857F72',
  stone600: '#63665D',
  stone700: '#565A50',
  stone900: '#22251F',

  green50: '#F0F7F1',
  green100: '#E3F0E6',
  green200: '#C7E1CE',
  green500: '#3F8A63',
  green600: '#2B6E4D',
  green700: '#1F5A3D',

  ochre100: '#F6EBCF',
  ochre500: '#9A7420',
  ochre700: '#7A5A12',

  terra100: '#F7E3DD',
  terra700: '#9B3522',

  slate100: '#E2ECF3',
  slate700: '#2E5470',

  night900: '#141613',
  night800: '#1C1F1B',
  night700: '#232722',
  night600: '#343931',
  night400: '#7D8378',
  nightText: '#ECEDE7',
  nightMuted: '#B5B8AE',
  nightSubtle: '#9A9E93',
  green300: '#8CCBA4',
  greenContainerDark: '#1E3B2B',
  onGreenContainerDark: '#CDEBD6',
  ochre300: '#E2C27A',
  ochreContainerDark: '#3A2F14',
  terra300: '#F0A08E',
  terraContainerDark: '#45231B',
  slate300: '#9CC2DE',
  slateContainerDark: '#1D3445',
} as const;

export type PaletteKey = keyof typeof palette;
