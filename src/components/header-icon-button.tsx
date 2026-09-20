import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

// mirrors ios's automatic toolbar-button styling on a plain Image(systemName:) action item —
// a circular, surface-tinted bubble with a soft top highlight (ios's "glass" material effect),
// used for standalone icon actions like the "+" add button instead of a flat text pill
export function HeaderIconButton({
  icon,
  onPress,
  size = 40,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  size?: number;
}) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={8} style={[styles.button, { width: size, height: size, borderRadius: size / 2 }]}>
      <Svg width={size} height={size} style={styles.svg}>
        <Defs>
          <LinearGradient id="glassHighlight" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.2} />
            <Stop offset="0.55" stopColor="#FFFFFF" stopOpacity={0.02} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={theme.surface} />
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill="url(#glassHighlight)" />
      </Svg>
      <Ionicons name={icon} size={Math.round(size * 0.52)} color={theme.accent} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  svg: { position: 'absolute', top: 0, left: 0 },
});
