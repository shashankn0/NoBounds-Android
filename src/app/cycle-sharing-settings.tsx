import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import {
  loadHideMyCycle,
  loadPartnerCycleFirst,
  saveHideMyCycle,
  savePartnerCycleFirst,
} from '@/lib/cycle-display-preferences';
import { fetchSharingPermissions, instantUnlinkCycleSharing, upsertSharingPermissions } from '@/lib/cycle-tracking';
import type { CycleSharingPermissions } from '@/lib/database-types';

// port of features/cycletracking/cyclesharingsettingsview.swift
const PERMISSION_ROWS: { key: keyof Omit<CycleSharingPermissions, 'user_id' | 'updated_at'>; label: string }[] = [
  { key: 'share_phase', label: 'Cycle phase & timeline' },
  { key: 'share_period_dates', label: 'Period start dates' },
  { key: 'share_flow_details', label: 'Flow details' },
  { key: 'share_moods', label: 'Moods' },
  { key: 'share_symptoms', label: 'Symptoms' },
];

export default function CycleSharingSettingsScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [hideMyCycle, setHideMyCycle] = useState(false);
  const [partnerCycleFirst, setPartnerCycleFirst] = useState(false);
  const [permissions, setPermissions] = useState<CycleSharingPermissions | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([loadHideMyCycle(), loadPartnerCycleFirst(), fetchSharingPermissions()])
      .then(([hide, first, perms]) => {
        setHideMyCycle(hide);
        setPartnerCycleFirst(first);
        setPermissions(perms);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load settings'))
      .finally(() => setLoading(false));
  }, []);

  function onToggleHideMyCycle(value: boolean) {
    setHideMyCycle(value);
    saveHideMyCycle(value);
  }

  function onTogglePartnerCycleFirst(value: boolean) {
    setPartnerCycleFirst(value);
    savePartnerCycleFirst(value);
  }

  function onTogglePermission(key: (typeof PERMISSION_ROWS)[number]['key'], value: boolean) {
    setPermissions((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  async function onSavePermissions() {
    if (!permissions) return;
    setSaving(true);
    setError(null);
    try {
      const { user_id: _userId, updated_at: _updatedAt, ...rest } = permissions;
      await upsertSharingPermissions(rest);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save permissions');
    } finally {
      setSaving(false);
    }
  }

  function onInstantUnlink() {
    Alert.alert(
      'Stop sharing cycle data?',
      "Your partner will lose access immediately. Historical logs stay on your account.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Instant Unlink',
          style: 'destructive',
          onPress: async () => {
            setUnlinking(true);
            try {
              await instantUnlinkCycleSharing();
              router.back();
            } catch (err) {
              setError(err instanceof Error ? err.message : 'Could not unlink');
              setUnlinking(false);
            }
          },
        },
      ]
    );
  }

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <ThemedText type="default" themeColor="textSecondary">
          Loading…
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={[styles.container, { paddingBottom: insets.bottom + 20 }]}>
        <ThemedText type="default" themeColor="textSecondary">
          Choose what your partner can see. You can change these anytime.
        </ThemedText>

        <NBCard>
          <ThemedText type="smallBold">Display</ThemedText>
          <ToggleRow label="Hide my cycle" value={hideMyCycle} onValueChange={onToggleHideMyCycle} theme={theme} />
          <ToggleRow label="Show partner's cycle first" value={partnerCycleFirst} onValueChange={onTogglePartnerCycleFirst} theme={theme} />
          <ThemedText type="small" themeColor="textSecondary" style={styles.footerCaption}>
            Display preferences only change what you see on this device. They never affect what your partner can view.
          </ThemedText>
        </NBCard>

        {permissions ? (
          <NBCard>
            <ThemedText type="smallBold">Sharing permissions</ThemedText>
            {PERMISSION_ROWS.map((row) => (
              <ToggleRow
                key={row.key}
                label={row.label}
                value={permissions[row.key]}
                onValueChange={(value) => onTogglePermission(row.key, value)}
                theme={theme}
              />
            ))}
          </NBCard>
        ) : null}

        <NBPrimaryButton title={saving ? 'Saving…' : 'Save permissions'} onPress={onSavePermissions} disabled={saving || !permissions} />

        <NBCard>
          <Pressable onPress={onInstantUnlink} disabled={unlinking}>
            <ThemedText type="smallBold" themeColor="destructive">
              {unlinking ? 'Unlinking…' : 'Instant Unlink'}
            </ThemedText>
          </Pressable>
          <ThemedText type="small" themeColor="textSecondary" style={styles.footerCaption}>
            Immediately stops sharing all cycle data with your partner. Your couple connection stays intact.
          </ThemedText>
        </NBCard>

        {error ? (
          <ThemedText type="small" themeColor="destructive">
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

function ToggleRow({
  label,
  value,
  onValueChange,
  theme,
}: {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  theme: ReturnType<typeof useTheme>;
}) {
  return (
    <View style={styles.toggleRow}>
      <ThemedText type="default" style={styles.toggleLabel}>
        {label}
      </ThemedText>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: theme.accent, false: theme.border }} thumbColor="#ffffff" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  toggleLabel: { flex: 1 },
  footerCaption: { marginTop: 8 },
});
