import { Pressable, StyleSheet, type GestureResponderEvent } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type NBButtonProps = {
  title: string;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
};

// mirrors nbprimarybutton.swift: accent fill, 12pt radius, semibold label. use for the main action.
export function NBPrimaryButton({ title, onPress, disabled }: NBButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: theme.accent, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}>
      <ThemedText type="smallBold" style={[styles.label, { color: theme.textOnAccent }]}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

// mirrors nbsecondarybutton.swift: surface fill, accent-colored 1.5pt border. use for lesser actions.
export function NBSecondaryButton({ title, onPress, disabled }: NBButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: theme.surface,
          borderWidth: 1.5,
          borderColor: theme.accent,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}>
      <ThemedText type="smallBold" style={styles.label}>
        {title}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  label: { fontSize: 16 },
});
