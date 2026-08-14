import { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type IconName = keyof typeof Ionicons.glyphMap;

// Matches MainTab order + SF Symbols in ../NoBounds/NoBounds/Core/Navigation: home, prompt, photos, play, timeline.
const TABS: { name: string; href: Href; label: string; icon: IconName; iconFocused: IconName }[] = [
  { name: 'home', href: '/', label: 'Home', icon: 'home-outline', iconFocused: 'home' },
  { name: 'prompt', href: '/prompt', label: 'Prompt', icon: 'chatbubbles-outline', iconFocused: 'chatbubbles' },
  { name: 'photos', href: '/photos', label: 'Bound', icon: 'camera-outline', iconFocused: 'camera' },
  { name: 'play', href: '/play', label: 'Play', icon: 'game-controller-outline', iconFocused: 'game-controller' },
  { name: 'timeline', href: '/timeline', label: 'Timeline', icon: 'time-outline', iconFocused: 'time' },
];

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <CustomTabList>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton icon={tab.icon} iconFocused={tab.iconFocused} label={tab.label} />
            </TabTrigger>
          ))}
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

function TabButton({
  isFocused,
  icon,
  iconFocused,
  label,
  ...props
}: TabTriggerSlotProps & { icon: IconName; iconFocused: IconName; label: string }) {
  const theme = useTheme();
  const color = isFocused ? theme.tabBarItemSelected : theme.tabBarItemUnselected;

  return (
    <Pressable {...props} style={styles.tabButton}>
      <View style={[styles.iconWrap, isFocused && { backgroundColor: theme.accentMuted + '33' }]}>
        <Ionicons name={isFocused ? iconFocused : icon} size={20} color={color} />
      </View>
      <ThemedText type="small" style={[styles.label, { color }]}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

function CustomTabList(props: { children?: React.ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.tabListContainer, { paddingBottom: insets.bottom || 12 }]}>
      <View style={[styles.innerContainer, { backgroundColor: theme.tabBarBackground, borderColor: theme.border }]}>
        {props.children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tabListContainer: {
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 8,
    alignItems: 'center',
  },
  innerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderRadius: 28,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 6,
    width: '100%',
    maxWidth: 480,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  tabButton: { flex: 1, alignItems: 'center', gap: 2 },
  iconWrap: { width: 36, height: 28, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
  label: { fontSize: 11, fontWeight: '600' },
});
