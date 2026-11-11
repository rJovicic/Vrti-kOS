/** 4-point spacing scale (dp on mobile, px on web). */
export const space = { 0: 0, 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;

/** Rounded but restrained. */
export const radius = { sm: 6, segment: 8, md: 10, tag: 12, lg: 14, bubble: 16, sheet: 20, pill: 999 } as const;

/** Minimum touch targets per platform (iOS HIG 44pt, Material 48dp, WCAG 2.2 target size 24px on web). */
export const touchTarget = { ios: 44, android: 48, web: 24, attendanceTag: 64 } as const;

export interface TypeStyle {
  size: number;
  lineHeight: number;
  weight: '400' | '500' | '600' | '700';
  tracking?: number;
}

/**
 * Type roles. Mobile uses the platform faces (SF Pro / Roboto) and scales with the OS text size;
 * web uses the system stack. Every face in the stack covers Croatian diacritics (č ć đ š ž).
 */
export const type = {
  caption: { size: 13, lineHeight: 18, weight: '500' },
  footnote: { size: 14, lineHeight: 20, weight: '400' },
  body: { size: 16, lineHeight: 24, weight: '400' },
  bodyStrong: { size: 16, lineHeight: 24, weight: '600' },
  label: { size: 15, lineHeight: 20, weight: '600' },
  title3: { size: 18, lineHeight: 24, weight: '600' },
  title2: { size: 22, lineHeight: 28, weight: '700', tracking: -0.2 },
  title1: { size: 28, lineHeight: 34, weight: '700', tracking: -0.4 },
} as const satisfies Record<string, TypeStyle>;

export const fontStack = {
  web: 'system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Helvetica Neue", Arial, sans-serif',
  webMono: 'ui-monospace, "SF Mono", "Cascadia Mono", "Roboto Mono", monospace',
} as const;

/** Elevation: offset + soft blur, neutral ink. One raised level and one overlay level only. */
export const shadow = {
  raised: { x: 0, y: 1, blur: 3, spread: 0, color: 'rgba(34, 37, 31, 0.08)' },
  overlay: { x: 0, y: 8, blur: 24, spread: -4, color: 'rgba(34, 37, 31, 0.18)' },
} as const;

/** Motion: exponential ease-out, short. Respect reduced motion (instant state change instead). */
export const motion = {
  fast: 120,
  base: 200,
  slow: 320,
  undoWindowMs: 10_000,
  easeOut: 'cubic-bezier(0.16, 1, 0.3, 1)',
} as const;

export const breakpoints = { compact: 0, medium: 600, expanded: 960, wide: 1280 } as const;
