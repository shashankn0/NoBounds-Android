import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { NBCard } from '@/components/nb-card';
import { NBPrimaryButton } from '@/components/nb-button';
import { NBListRow } from '@/components/nb-list-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { supabase } from '@/lib/supabase';

const deviceTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export default function ProfileScreen() {
  const theme = useTheme();
  const { session, profile, refreshProfile } = useSession();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSaveName() {
    if (!session || name.trim().length === 0) return;
    setSaving(true);
    setSaved(false);
    setError(null);
    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        display_name: name.trim(),
        time_zone: profile?.time_zone ?? deviceTimeZone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.user.id);
    setSaving(false);
    if (updateError) {
      setError(updateError.message);
      return;
    }
    setSaved(true);
    await refreshProfile();
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.avatarSection}>
          <View style={[styles.avatar, { backgroundColor: theme.accentMuted }]}>
            <Ionicons name="person" size={44} color={theme.textOnAccent} />
          </View>
          <Pressable>
            <ThemedText type="link" themeColor="accent">
              Change photo
            </ThemedText>
          </Pressable>
        </View>

        <NBCard>
          <ThemedText type="small" themeColor="textSecondary">
            Display name
          </ThemedText>
          <TextInput
            placeholder="Your name"
            placeholderTextColor={theme.textSecondary}
            value={name}
            onChangeText={(text) => {
              setName(text);
              setSaved(false);
            }}
            style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
          />
          <View style={styles.cardButton}>
            <NBPrimaryButton
              title={saving ? 'Saving…' : 'Save name'}
              onPress={onSaveName}
              disabled={saving || name.trim().length === 0}
            />
          </View>
          {saved ? (
            <ThemedText type="small" themeColor="textSecondary" style={styles.savedText}>
              Saved.
            </ThemedText>
          ) : null}
          {error ? (
            <ThemedText type="small" themeColor="destructive" style={styles.savedText}>
              {error}
            </ThemedText>
          ) : null}
        </NBCard>

        <NBCard>
          <ThemedText type="small" themeColor="textSecondary">
            Time zone
          </ThemedText>
          <ThemedText type="default" style={styles.rowValue}>
            {(profile?.time_zone ?? deviceTimeZone).replace(/_/g, ' ')}
          </ThemedText>
          <View style={[styles.divider, { backgroundColor: theme.separator }]} />
          <ThemedText type="small" themeColor="textSecondary">
            Member since
          </ThemedText>
          <ThemedText type="default" style={styles.rowValue}>
            {profile
              ? new Date(profile.created_at).toLocaleDateString(undefined, {
                  month: 'long',
                  day: 'numeric',
                  year: 'numeric',
                })
              : '—'}
          </ThemedText>
        </NBCard>

        <NBCard style={styles.rowsCard}>
          <NBListRow icon="notifications-outline" title="Notification center" onPress={() => router.push('/notifications')} />
          <NBListRow icon="color-palette-outline" title="Appearance" onPress={() => router.push('/settings/appearance')} />
          <NBListRow icon="chatbox-ellipses-outline" title="Feedback & support" />
          <NBListRow icon="settings-outline" title="Settings" onPress={() => router.push('/settings')} />
        </NBCard>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  avatarSection: { alignItems: 'center', gap: 8, marginBottom: 4 },
  avatar: { width: 96, height: 96, borderRadius: 48, alignItems: 'center', justifyContent: 'center' },
  input: { borderBottomWidth: 1, paddingVertical: 8, fontSize: 16, marginTop: 4, marginBottom: 4 },
  cardButton: { marginTop: 8 },
  savedText: { marginTop: 8 },
  rowValue: { marginTop: 2, marginBottom: 8 },
  divider: { height: 1, marginBottom: 8 },
  rowsCard: { paddingVertical: 4 },
});
