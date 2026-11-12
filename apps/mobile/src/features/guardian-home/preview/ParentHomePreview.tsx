// Development-only design preview of Parent Home with synthetic data and a local state switcher.
// Loaded exclusively through app/dev/parent-home.tsx behind __DEV__; it calls no backend and needs no session.
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { orgLocalDate } from '@vrticos/domain';
import { radius, space, touchTarget, type } from '@vrticos/tokens';
import { useColors } from '../../../ui/theme';
import { GuardianHomeScreen } from '../GuardianHomeScreen';
import type { HomeScreenState } from '../model/types';
import { previewGuardianHome } from './fixtures';

const STATES: HomeScreenState[] = ['success', 'loading', 'empty', 'error', 'partialError', 'offline'];

export function ParentHomePreview() {
  const { t } = useTranslation();
  const c = useColors();
  const [state, setState] = useState<HomeScreenState>('success');
  const data = state === 'empty' ? { children: [], activities: [] } : previewGuardianHome(orgLocalDate(new Date()));

  // Local demonstration only: "retry" shows loading briefly, then the synthetic data again.
  const retry = () => {
    setState('loading');
    setTimeout(() => setState('success'), 600);
  };

  return (
    <View style={{ flex: 1 }}>
      <View style={[styles.bar, { backgroundColor: c.bgSunken, borderColor: c.borderSubtle }]}>
        <Text style={[styles.label, { color: c.textSecondary }]}>{t('guardianHome.previewLabel')}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityLabel={t('guardianHome.previewStates')}>
          {STATES.map((s) => (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityState={{ selected: s === state }}
              onPress={() => setState(s)}
              style={[styles.chip, { borderColor: s === state ? c.statePresentBorder : c.borderControl, backgroundColor: s === state ? c.accentSoft : c.bgSurface }]}
            >
              <Text style={[styles.chipText, { color: s === state ? c.textAccent : c.textPrimary }]}>{t(`guardianHome.previewStateNames.${s}`)}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <GuardianHomeScreen state={state} data={state === 'loading' || state === 'error' ? null : data} onRetry={retry} onRefresh={retry} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { borderBottomWidth: StyleSheet.hairlineWidth, paddingTop: space[2], gap: space[2] },
  label: { paddingHorizontal: space[4], fontSize: type.caption.size, lineHeight: type.caption.lineHeight, fontWeight: type.caption.weight },
  chips: { paddingHorizontal: space[4], paddingBottom: space[2], gap: space[2] },
  chip: { minHeight: touchTarget.ios, justifyContent: 'center', paddingHorizontal: space[3], borderRadius: radius.pill, borderWidth: 1.5 },
  chipText: { fontSize: type.footnote.size, fontWeight: '600' },
});
