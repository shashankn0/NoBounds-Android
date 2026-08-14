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

export default function ProfileScreen() {
  const theme = useTheme();
  const { profile } = useSession();
  const [name, setName] = useState(profile?.display_name ?? '');

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
            onChangeText={setName}
            style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
          />
          <View style={styles.cardButton}>
            <NBPrimaryButton title="Save name" />
          </View>
        </NBCard>

        <NBCard>
          <ThemedText type="small" themeColor="textSecondary">
            Time zone
          </ThemedText>
          <ThemedText type="default" style={styles.rowValue}>
            {Intl.DateTimeFormat().resolvedOptions().timeZone}
          </ThemedText>
          <View style={[styles.divider, { backgroundColor: theme.separator }]} />
          <ThemedText type="small" themeColor="textSecondary">
            Member since
          </ThemedText>
          <ThemedText type="default" style={styles.rowValue}>
            {new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
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
  rowValue: { marginTop: 2, marginBottom: 8 },
  divider: { height: 1, marginBottom: 8 },
  rowsCard: { paddingVertical: 4 },
});
