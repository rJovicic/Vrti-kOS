import { RefreshControl, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { orgLocalDate } from '@vrticos/domain';
import { formatLongDate } from '@vrticos/i18n';
import { radius, space, type } from '@vrticos/tokens';
import { Button } from '../../ui/Button';
import { Notice } from '../../ui/Notice';
import { useColors } from '../../ui/theme';
import { ActivityRow } from './components/ActivityRow';
import { ChildSummaryCard } from './components/ChildSummaryCard';
import { InlineBanner } from './components/InlineBanner';
import { ActivityRowSkeleton, ChildCardSkeleton } from './components/Skeleton';
import { raised } from './components/surface';
import { childColumns, greetingKey, homeActivities, sectionPlan } from './model/present';
import type { GuardianHomeData, HomeScreenState } from './model/types';

export interface GuardianHomeScreenProps {
  state: HomeScreenState;
  /** Authorized, presentation-ready data. Never synthetic outside the development preview. */
  data: GuardianHomeData | null;
  /** Clock for greeting/date; injectable for previews and tests. */
  now?: Date;
  timeZone?: string;
  onRetry?: () => void;
  onRefresh?: () => void;
  refreshing?: boolean;
  onOpenChild?: (childId: string) => void;
  /** Each absence action stays disabled until its own destination screen exists (D2+). */
  onReportAbsence?: (childId: string) => void;
  onReviewAbsence?: (childId: string) => void;
  onOpenActivity?: (activityId: string) => void;
}

const MAX_CONTENT_WIDTH = 720; // spec §7

/** Parent Home (docs/design/parent-home-spec.md). Presentational: everything arrives through props. */
export function GuardianHomeScreen(props: GuardianHomeScreenProps) {
  const { state, data, now = new Date(), timeZone = 'Europe/Zagreb' } = props;
  const { t } = useTranslation();
  const c = useColors();
  const insets = useSafeAreaInsets();
  const { width, fontScale } = useWindowDimensions();
  const plan = sectionPlan(state, data);
  const children = data?.children ?? [];
  const activities = homeActivities(data?.activities ?? []);
  const today = orgLocalDate(now, timeZone);
  const hour = Number(new Intl.DateTimeFormat('en-GB', { hour: '2-digit', hourCycle: 'h23', timeZone }).format(now));
  const columns = plan.children === 'list' || plan.children === 'skeleton' ? childColumns(width, fontScale, plan.children === 'list' ? children.length : 2) : 1;
  const contentWidth = Math.min(width, MAX_CONTENT_WIDTH) - space[4] * 2;
  const cardWidth = columns === 2 ? (contentWidth - space[3]) / 2 : undefined;

  return (
    <ScrollView
      style={{ backgroundColor: c.bgCanvas }}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + space[8] }]}
      refreshControl={props.onRefresh ? <RefreshControl refreshing={props.refreshing ?? false} onRefresh={props.onRefresh} /> : undefined}
    >
      <View style={styles.column}>
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.greeting, { color: c.textPrimary }]}>
            {t(greetingKey(hour))}
          </Text>
          <Text style={[styles.date, { color: c.textSecondary }]}>{formatLongDate(now, timeZone)}</Text>
        </View>

        {plan.showOfflineBanner ? <InlineBanner text={t('guardianHome.offline')} /> : null}

        {plan.fullError ? (
          <View style={styles.section}>
            <Notice tone="error" title={t('mobile.loadError')} body={t('mobile.loadErrorHelp')} />
            {props.onRetry ? <Button variant="secondary" label={t('common.retry')} onPress={props.onRetry} /> : null}
          </View>
        ) : null}

        {plan.children !== 'hidden' ? (
          <View style={styles.section} accessibilityState={{ busy: plan.children === 'skeleton' }}>
            <Text accessibilityRole="header" style={[styles.h2, { color: c.textPrimary }]}>
              {t('mobile.myChildren')}
            </Text>
            {plan.children === 'empty' ? (
              // Same component and copy as the existing guardian empty state (spec §8, app/home.tsx).
              <Notice title={t('mobile.noData')} body={t('mobile.noDataHelp')} />
            ) : (
              <View style={[styles.cards, columns === 2 && styles.cardsGrid]} accessibilityLabel={plan.children === 'skeleton' ? t('common.loading') : undefined}>
                {plan.children === 'skeleton'
                  ? [0, 1].map((i) => (
                      <View key={i} style={cardWidth ? { width: cardWidth } : undefined}>
                        <ChildCardSkeleton />
                      </View>
                    ))
                  : children.map((child) => (
                      <View key={child.id} style={cardWidth ? { width: cardWidth } : undefined}>
                        <ChildSummaryCard
                          child={child}
                          today={today}
                          actionsEnabled={plan.actionsEnabled}
                          onOpen={props.onOpenChild ? () => props.onOpenChild?.(child.id) : undefined}
                          onReportAbsence={props.onReportAbsence ? () => props.onReportAbsence?.(child.id) : undefined}
                          onReviewAbsence={props.onReviewAbsence ? () => props.onReviewAbsence?.(child.id) : undefined}
                        />
                      </View>
                    ))}
              </View>
            )}
          </View>
        ) : null}

        {plan.today !== 'hidden' ? (
          <View style={styles.section}>
            <Text accessibilityRole="header" style={[styles.h2, { color: c.textPrimary }]}>
              {t('guardianHome.today')}
            </Text>
            {plan.today === 'error' ? (
              <View style={styles.section}>
                <Notice title={t('guardianHome.partialError')} />
                {props.onRetry ? <Button variant="secondary" label={t('common.retry')} onPress={props.onRetry} /> : null}
              </View>
            ) : plan.today === 'noContent' ? (
              <Notice title={t('guardianHome.noContent')} />
            ) : (
              <View style={[styles.list, raised, { backgroundColor: c.bgSurface, borderColor: c.borderSubtle }]}>
                {plan.today === 'skeleton'
                  ? [0, 1].map((i) => <ActivityRowSkeleton key={i} first={i === 0} />)
                  : activities.map((a, i) => (
                      <ActivityRow key={a.id} activity={a} first={i === 0} onOpen={props.onOpenActivity ? () => props.onOpenActivity?.(a.id) : undefined} />
                    ))}
              </View>
            )}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space[4], paddingTop: space[3] },
  column: { width: '100%', maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', gap: space[6] },
  header: { gap: space[1] },
  greeting: { fontSize: type.title1.size, lineHeight: type.title1.lineHeight, fontWeight: type.title1.weight, letterSpacing: type.title1.tracking },
  date: { fontSize: type.footnote.size, lineHeight: type.footnote.lineHeight },
  section: { gap: space[3] },
  h2: { fontSize: type.title3.size, lineHeight: type.title3.lineHeight, fontWeight: type.title3.weight },
  cards: { gap: space[3] },
  cardsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  list: { borderWidth: StyleSheet.hairlineWidth, borderRadius: radius.lg },
});
