import { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type IconName = keyof typeof Ionicons.glyphMap;

// Matches MainTab order + SF Symbols in ../NoBounds/NoBounds/Core/Navigation: home, prompt, photos, play, timeline.
// iOS always renders the filled glyph (selection is shown via the circular badge + color, not
// an outline/filled swap), so there's a single icon per tab here.
const TABS: { name: string; href: Href; label: string; icon: IconName }[] = [
  { name: 'home', href: '/', label: 'Home', icon: 'home' },
  { name: 'prompt', href: '/prompt', label: 'Prompt', icon: 'chatbubbles' },
  { name: 'photos', href: '/photos', label: 'Bound', icon: 'camera' },
  { name: 'play', href: '/play', label: 'Play', icon: 'game-controller' },
  { name: 'timeline', href: '/timeline', label: 'Timeline', icon: 'time' },
];

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ flex: 1 }} />
      <TabList asChild>
        <CustomTabList>
          {TABS.map((tab) => (
            <TabTrigger key={tab.name} name={tab.name} href={tab.href} asChild>
              <TabButton icon={tab.icon} label={tab.label} />
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
  label,
  ...props
}: TabTriggerSlotProps & { icon: IconName; label: string }) {
  const theme = useTheme();
  const labelColor = isFocused ? theme.tabBarItemSelected : theme.tabBarItemUnselected;

  return (
    <Pressable {...props} style={styles.tabButton}>
      <View style={[styles.badge, { backgroundColor: isFocused ? theme.accentMuted : 'transparent' }]}>
        <Ionicons name={icon} size={22} color={isFocused ? theme.textOnAccent : theme.tabBarItemUnselected} />
      </View>
      <ThemedText
        type="small"
        style={[styles.label, { color: labelColor }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}>
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
    paddingHorizontal: 10,
    paddingTop: 8,
    alignItems: 'center',
  },
  innerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // Larger than any plausible half-height so the bar always renders as a true rounded
    // capsule (matches the pill buttons/search bar elsewhere), regardless of content height.
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    width: '100%',
    maxWidth: 480,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  tabButton: { flex: 1, alignItems: 'center', gap: 3 },
  badge: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    // Android-only quirk: a View's backgroundColor going from absent to present on an
    // already-mounted node can render square instead of picking up borderRadius on that
    // update — see the isFocused ? accentMuted : 'transparent' below (always-present value,
    // never an added/removed key) which is the real fix. overflow:'hidden' is belt-and-suspenders.
    overflow: 'hidden',
  },
  label: { fontSize: 11, fontWeight: '600' },
});
