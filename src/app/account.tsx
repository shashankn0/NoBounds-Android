import { useState } from 'react';
import { Alert, Pressable, StyleSheet } from 'react-native';

import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/contexts/session-context';
import { functionErrorMessage, supabase } from '@/lib/supabase';

export default function AccountScreen() {
  const { signOut } = useSession();
  const [deleting, setDeleting] = useState(false);

  function onDeleteAccount() {
    Alert.alert(
      'Delete your account?',
      'This permanently deletes your profile, habits, memories, and photos. This can’t be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            const { error } = await supabase.functions.invoke('delete-account', { body: { confirm: true } });
            setDeleting(false);
            if (error) {
              Alert.alert('Could not delete account', await functionErrorMessage(error, 'Something went wrong'));
              return;
            }
            await signOut();
          },
        },
      ]
    );
  }

  return (
    <ThemedView style={styles.container}>
      <NBCard>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subheadline}>
          Permanently remove your account and all data stored with NoBounds.
        </ThemedText>
      </NBCard>

      <NBCard>
        <Pressable onPress={onDeleteAccount} disabled={deleting}>
          <ThemedText type="default" themeColor="destructive" style={{ opacity: deleting ? 0.5 : 1 }}>
            {deleting ? 'Deleting…' : 'Delete account'}
          </ThemedText>
        </Pressable>
      </NBCard>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  subheadline: { fontSize: 14, lineHeight: 19 }, // ios .subheadline
  container: { flex: 1, padding: 20, gap: 16 },
});
