import { useColorScheme } from 'react-native';
import { themes, type ColorRoles } from '@vrticos/tokens';

/** Semantic colour roles for the current OS appearance. Dark scheme is defined; the demo is designed light-first. */
export function useColors(): ColorRoles {
  return themes[useColorScheme() === 'dark' ? 'dark' : 'light'];
}
