import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { FormHeader } from '@/components/form-header';
import { NBCard } from '@/components/nb-card';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSession } from '@/contexts/session-context';
import { useTheme } from '@/hooks/use-theme';
import { createHabit, type HabitCompletionPolicy, type HabitOwnerScope } from '@/lib/habits';

type Page = 'habit' | 'important_date';

const SCOPES: { id: HabitOwnerScope; label: string }[] = [
  { id: 'mine', label: 'Mine' },
  { id: 'yours', label: "Partner's" },
  { id: 'ours', label: 'Ours' },
];

const POLICIES: { id: HabitCompletionPolicy; label: string; caption: string }[] = [
  { id: 'either', label: 'Either partner', caption: 'Either of you checking in counts for the day.' },
  { id: 'both', label: 'Both required', caption: 'Both of you need to check in for the day to count.' },
];

export default function HabitFormScreen() {
  const theme = useTheme();
  const { couple } = useSession();
  const [page, setPage] = useState<Page>('habit');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [repeatsYearly, setRepeatsYearly] = useState(false);
  const [scope, setScope] = useState<HabitOwnerScope>('mine');
  const [policy, setPolicy] = useState<HabitCompletionPolicy>('either');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSave() {
    if (title.trim().length === 0) return;

    if (page === 'important_date') {
      // Important dates aren't wired to a backend yet in this prototype — just dismiss.
      router.back();
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await createHabit(title.trim(), couple?.id ?? null, couple ? scope : 'mine', policy);
      router.back();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save habit');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={{ flex: 1 }}>
      <FormHeader
        title={page === 'habit' ? 'New habit' : 'New important date'}
        leftLabel="Cancel"
        onLeftPress={() => router.back()}
        rightLabel={saving ? 'Saving…' : 'Save'}
        onRightPress={onSave}
        rightDisabled={title.trim().length === 0 || saving}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={[styles.segmented, { backgroundColor: theme.backgroundSecondary }]}>
          {(['habit', 'important_date'] as Page[]).map((id) => (
            <Pressable key={id} onPress={() => setPage(id)} style={styles.segmentWrap}>
              <View style={[styles.segment, page === id && { backgroundColor: theme.surface }]}>
                <ThemedText type="smallBold">{id === 'habit' ? 'Habit' : 'Important date'}</ThemedText>
              </View>
            </Pressable>
          ))}
        </View>

        {page === 'habit' ? (
          <>
            <NBCard>
              <ThemedText type="small" themeColor="textSecondary">
                Habit
              </ThemedText>
              <TextInput
                placeholder="Title"
                placeholderTextColor={theme.textSecondary}
                value={title}
                onChangeText={setTitle}
                style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
              />
            </NBCard>

            {couple ? (
              <>
                <NBCard>
                  <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
                    Who is this for?
                  </ThemedText>
                  <View style={[styles.segmented, { backgroundColor: theme.backgroundSecondary }]}>
                    {SCOPES.map((s) => (
                      <Pressable key={s.id} onPress={() => setScope(s.id)} style={styles.segmentWrap}>
                        <View style={[styles.segment, scope === s.id && { backgroundColor: theme.surface }]}>
                          <ThemedText type="smallBold">{s.label}</ThemedText>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                </NBCard>

                {scope === 'ours' ? (
                  <NBCard>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
                      Completion
                    </ThemedText>
                    <View style={[styles.segmented, { backgroundColor: theme.backgroundSecondary }]}>
                      {POLICIES.map((p) => (
                        <Pressable key={p.id} onPress={() => setPolicy(p.id)} style={styles.segmentWrap}>
                          <View style={[styles.segment, policy === p.id && { backgroundColor: theme.surface }]}>
                            <ThemedText type="smallBold">{p.label}</ThemedText>
                          </View>
                        </Pressable>
                      ))}
                    </View>
                    <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
                      {POLICIES.find((p) => p.id === policy)?.caption}
                    </ThemedText>
                  </NBCard>
                ) : null}
              </>
            ) : (
              <NBCard>
                <ThemedText type="small" themeColor="textSecondary">
                  Solo habits are personal until you connect with your partner.
                </ThemedText>
              </NBCard>
            )}
          </>
        ) : (
          <>
            <NBCard>
              <ThemedText type="small" themeColor="textSecondary">
                Important date
              </ThemedText>
              <TextInput
                placeholder="Title"
                placeholderTextColor={theme.textSecondary}
                value={title}
                onChangeText={setTitle}
                style={[styles.input, { color: theme.textPrimary, borderColor: theme.border }]}
              />
              <TextInput
                placeholder="Description (optional)"
                placeholderTextColor={theme.textSecondary}
                value={description}
                onChangeText={setDescription}
                multiline
                style={[styles.input, styles.multilineInput, { color: theme.textPrimary, borderColor: theme.border }]}
              />
            </NBCard>

            <NBCard>
              <ThemedText type="small" themeColor="textSecondary" style={styles.sectionLabel}>
                When
              </ThemedText>
              <View style={[styles.datePill, { backgroundColor: theme.backgroundSecondary }]}>
                <ThemedText type="default">
                  {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                </ThemedText>
              </View>
              <View style={styles.toggleRow}>
                <ThemedText type="default" style={styles.toggleLabel}>
                  Repeats yearly
                </ThemedText>
                <Switch
                  value={repeatsYearly}
                  onValueChange={setRepeatsYearly}
                  trackColor={{ true: theme.accent, false: theme.border }}
                />
              </View>
            </NBCard>

            <NBCard>
              <ThemedText type="small" themeColor="textSecondary">
                Important dates are marked on the calendar and shared with your partner once you&apos;re connected.
              </ThemedText>
            </NBCard>
          </>
        )}

        {error ? (
          <ThemedText type="small" themeColor="destructive">
            {error}
          </ThemedText>
        ) : null}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  segmented: { flexDirection: 'row', borderRadius: 12, padding: 4 },
  segmentWrap: { flex: 1 },
  segment: { paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  sectionLabel: { marginBottom: 8 },
  input: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16, marginTop: 8 },
  multilineInput: { minHeight: 70, textAlignVertical: 'top' },
  caption: { marginTop: 8 },
  datePill: { borderRadius: 999, paddingVertical: 10, paddingHorizontal: 16, alignSelf: 'flex-start' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  toggleLabel: { flex: 1 },
});
