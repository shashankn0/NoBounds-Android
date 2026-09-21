import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { DatePickerField } from '@/components/date-picker-field';
import { NBPrimaryButton, NBSecondaryButton } from '@/components/nb-button';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';
import { dateKey } from '@/lib/habits';
import { fetchReunionDates, formatReunionDateRange, reunionStatus, updateReunionDates, type ReunionStatus } from '@/lib/reunion';

// port of features/home/reunioncountdownpopover.swift — tapped from the "Paired with" header
// label instead of navigating away, mirroring ios's .popover presentation
export function ReunionPopover({
  visible,
  onClose,
  coupleId,
  partnerName,
}: {
  visible: boolean;
  onClose: () => void;
  coupleId: string;
  partnerName: string;
}) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [startDate, setStartDate] = useState<string | null>(null);
  const [endDate, setEndDate] = useState<string | null>(null);
  const [draftStart, setDraftStart] = useState('');
  const [draftEnd, setDraftEnd] = useState('');
  const [includesEnd, setIncludesEnd] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError(null);
    setIsEditing(false);
    fetchReunionDates(coupleId)
      .then(({ startDate: s, endDate: e }) => {
        setStartDate(s);
        setEndDate(e);
      })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load reunion details'))
      .finally(() => setLoading(false));
  }, [visible, coupleId]);

  // ios prepareDraftDates: start = the saved start (or today), end date toggled on only if one is saved
  function openEditor() {
    const today = dateKey(new Date());
    setDraftStart(startDate ?? today);
    setDraftEnd(endDate ?? startDate ?? today);
    setIncludesEnd(!!endDate);
    setError(null);
    setIsEditing(true);
  }

  function onChangeStart(next: string) {
    setDraftStart(next);
    // keep the range valid: the end can't precede the start
    if (draftEnd < next) setDraftEnd(next);
  }

  async function onSave() {
    setSaving(true);
    setError(null);
    const nextEnd = includesEnd ? draftEnd : null;
    try {
      await updateReunionDates(coupleId, draftStart, nextEnd);
      setStartDate(draftStart);
      setEndDate(nextEnd);
      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setSaving(false);
    }
  }

  const status = reunionStatus(startDate, endDate);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <View style={[styles.anchor, { paddingTop: insets.top + 64 }]}>
          <View style={[styles.caret, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]} />
          <Pressable onPress={() => {}} style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
            <ThemedText type="smallBold">Reunion with {partnerName}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.subtitle}>
              Your next visit together
            </ThemedText>

            {loading ? (
              <ThemedText type="default" themeColor="textSecondary" style={styles.body}>
                Loading…
              </ThemedText>
            ) : isEditing ? (
              <View style={styles.editForm}>
                <DatePickerField label="Start date" value={draftStart} onChange={onChangeStart} />

                <View style={styles.toggleRow}>
                  <ThemedText type="small" style={styles.toggleLabel}>
                    Include end date
                  </ThemedText>
                  <Switch
                    value={includesEnd}
                    onValueChange={setIncludesEnd}
                    trackColor={{ false: theme.textSecondary + '66', true: theme.accent }}
                    thumbColor="#FFFFFF"
                  />
                </View>

                {includesEnd ? <DatePickerField label="End date" value={draftEnd} onChange={setDraftEnd} minDate={draftStart} /> : null}

                <View style={styles.editButtons}>
                  <View style={styles.editButton}>
                    <NBSecondaryButton title="Cancel" onPress={() => setIsEditing(false)} disabled={saving} />
                  </View>
                  <View style={styles.editButton}>
                    <NBPrimaryButton title={saving ? 'Saving…' : 'Save'} onPress={onSave} disabled={saving} />
                  </View>
                </View>
              </View>
            ) : (
              <StatusContent status={status} startDate={startDate} endDate={endDate} theme={theme} onEdit={openEditor} />
            )}

            {error ? (
              <ThemedText type="small" themeColor="destructive" style={styles.body}>
                {error}
              </ThemedText>
            ) : null}
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

function StatusContent({
  status,
  startDate,
  endDate,
  theme,
  onEdit,
}: {
  status: ReunionStatus;
  startDate: string | null;
  endDate: string | null;
  theme: ReturnType<typeof useTheme>;
  onEdit: () => void;
}) {
  const rangeCaption = startDate ? (
    <ThemedText type="small" themeColor="textSecondary">
      {formatReunionDateRange(startDate, endDate)}
    </ThemedText>
  ) : null;

  switch (status.kind) {
    case 'noDateSet':
      return (
        <View style={styles.body}>
          <ThemedText type="default">Set your next visit to start a countdown.</ThemedText>
          <View style={styles.primaryButton}>
            <NBPrimaryButton title="Set reunion date" onPress={onEdit} />
          </View>
        </View>
      );
    case 'daysUntil':
      return (
        <View style={styles.body}>
          <ThemedText style={[styles.countdownNumber, { color: theme.accent }]}>{status.days}</ThemedText>
          <ThemedText type="smallBold">{status.days === 1 ? 'day until reunion' : 'days until reunion'}</ThemedText>
          {rangeCaption}
          <EditLink onPress={onEdit} />
        </View>
      );
    case 'today':
      return (
        <View style={styles.body}>
          <ThemedText type="subtitle" style={{ color: theme.accent }}>
            Reunion is today!
          </ThemedText>
          {rangeCaption}
          <EditLink onPress={onEdit} />
        </View>
      );
    case 'together':
      return (
        <View style={styles.body}>
          <ThemedText type="subtitle" style={{ color: theme.accent }}>
            Together now
          </ThemedText>
          <ThemedText type="default">Day {status.dayNumber} of your visit</ThemedText>
          {rangeCaption}
          <EditLink onPress={onEdit} />
        </View>
      );
    case 'past':
      return (
        <View style={styles.body}>
          <ThemedText type="default">Your last reunion date has passed.</ThemedText>
          {rangeCaption}
          <View style={styles.primaryButton}>
            <NBPrimaryButton title="Set next reunion" onPress={onEdit} />
          </View>
        </View>
      );
  }
}

function EditLink({ onPress }: { onPress: () => void }) {
  return (
    <Pressable onPress={onPress} hitSlop={8} style={styles.editLink}>
      <ThemedText type="smallBold" themeColor="accent">
        Edit dates
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  anchor: { alignItems: 'center' },
  caret: { width: 14, height: 14, borderRadius: 3, borderWidth: 1, transform: [{ rotate: '45deg' }], marginBottom: -8, zIndex: 1 },
  card: { width: 320, maxWidth: '88%', borderRadius: 16, borderWidth: 1, padding: 16 },
  subtitle: { marginTop: 2 },
  body: { marginTop: 14, gap: 8, alignItems: 'flex-start' },
  // ios editForm: VStack spacing 12; the toggle label is .subheadline
  editForm: { marginTop: 14, gap: 12, alignSelf: 'stretch' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  toggleLabel: { fontSize: 14, lineHeight: 19 },
  editButtons: { flexDirection: 'row', gap: 12, alignSelf: 'stretch' },
  editButton: { flex: 1 },
  primaryButton: { marginTop: 4, alignSelf: 'stretch' },
  countdownNumber: { fontSize: 32, lineHeight: 38, fontWeight: '700' }, // ios .largeTitle.bold
  editLink: { marginTop: 2 },
});
