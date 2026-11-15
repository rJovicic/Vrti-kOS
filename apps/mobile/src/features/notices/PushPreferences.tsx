import { useCallback, useEffect, useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { NotificationType } from '@vrticos/i18n';
import { loadPreferences, setPreference } from '../../lib/notices';
import { shellStyles } from '../../shell/ShellScreens';
import { Notice } from '../../ui/Notice';
import { useColors } from '../../ui/theme';

/**
 * FR-08-4: push on/off per type, stored for the person. Sending push is not enabled yet (D-40, ADR-0007): the screen says
 * so; the in-app notification centre is unaffected by these settings (AC-08-1).
 */
export function PushPreferences({ userId, types }: { userId: string; types: NotificationType[] }) {
  const { t } = useTranslation();
  const c = useColors();
  const [prefs, setPrefs] = useState<Record<NotificationType, boolean> | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    try {
      setPrefs(await loadPreferences());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);

  const toggle = async (type: NotificationType, value: boolean) => {
    setPrefs((p) => (p ? { ...p, [type]: value } : p));
    try {
      await setPreference(userId, type, value);
    } catch {
      setFailed(true);
      void load();
    }
  };

  return (
    <View style={shellStyles.section}>
      <Text accessibilityRole="header" style={[shellStyles.h2, { color: c.textPrimary }]}>
        {t('notices.pushTitle')}
      </Text>
      <Text style={[shellStyles.meta, { color: c.textSecondary }]}>{t('notices.pushNote')}</Text>
      {failed ? <Notice tone="error" title={t('notices.pushError')} /> : null}
      {prefs
        ? types.map((type) => (
            <View key={type} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 44 }}>
              <Text style={[shellStyles.body, { color: c.textPrimary, flex: 1 }]}>{t(`notices.pushType.${type}`)}</Text>
              <Switch accessibilityLabel={t(`notices.pushType.${type}`)} value={prefs[type]} onValueChange={(v) => void toggle(type, v)} />
            </View>
          ))
        : null}
    </View>
  );
}
