import { Ionicons } from '@expo/vector-icons';
import type { Href } from 'expo-router';
import { Tabs, TabList, TabTrigger, TabSlot, defaultTabsSlotRender, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/hooks/use-theme';

type IconName = keyof typeof Ionicons.glyphMap;

// matches maintab order + sf symbols in ../nobounds/nobounds/core/navigation: home, prompt, photos, play, timeline.
// ios always renders the filled glyph (selection is shown via the badge + tint, not an
// outline/filled swap), so there's a single icon per tab here.
const TABS: { name: string; href: Href; label: string; icon: IconName }[] = [
  { name: 'home', href: '/', label: 'Home', icon: 'home' },
  { name: 'prompt', href: '/prompt', label: 'Chat', icon: 'chatbubbles' },
  { name: 'photos', href: '/photos', label: 'Bound', icon: 'camera' },
  { name: 'play', href: '/play', label: 'Play', icon: 'game-controller' },
  { name: 'timeline', href: '/timeline', label: 'Timeline', icon: 'time' },
];

// floating pill tab bar, rendered on top of whichever tab screen is active
export default function AppTabs() {
  return (
    <Tabs>
      {/* tab screens stay mounted after their first visit, so without freezing, every hidden tab kept
          re-rendering in the background — pet sprite timers (8fps each), the play area's wander loops,
          the camera preview — starving the js thread and making the visible tab (timeline) laggy.
          freezeOnBlur suspends a hidden screen's rendering until it's focused again. */}
      <TabSlot
        style={{ flex: 1 }}
        renderFn={(descriptor, options) =>
          defaultTabsSlotRender({ ...descriptor, options: { ...descriptor.options, freezeOnBlur: true } }, options)
        }
      />
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
  const itemColor = isFocused ? theme.tabBarItemSelected : theme.tabBarItemUnselected;

  // ios wraps the icon *and* its label in one rounded badge, tinting both rather than
  // filling the badge with the accent — keeps the group tight and the icon large
  return (
    <Pressable {...props} style={styles.tabButton}>
      <View style={[styles.badge, { backgroundColor: isFocused ? theme.surface : 'transparent' }]}>
        <Ionicons name={icon} size={24} color={itemColor} />
        <ThemedText
          type="small"
          style={[styles.label, { color: itemColor }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}>
          {label}
        </ThemedText>
      </View>
    </Pressable>
  );
}

function CustomTabList(props: { children?: React.ReactNode }) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  return (
    // the +8 keeps the pill off android's own nav bar (gesture pill or 3-button row) rather
    // than letting it sit flush against it. the pill is ~46px tall, so scroll screens reserve
    // BottomTabInset (constants/theme.ts) above the system inset to clear it
    <View style={[styles.tabListContainer, { paddingBottom: (insets.bottom || 12) + 8 }]}>
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
    paddingHorizontal: 20,
    paddingTop: 6,
    alignItems: 'center',
  },
  innerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    // larger than any plausible half-height so the bar always renders as a true rounded
    // capsule (matches the pill buttons/search bar elsewhere), regardless of content height.
    borderRadius: 999,
    borderWidth: 1,
    paddingVertical: 2,
    paddingHorizontal: 4,
    width: '100%',
    maxWidth: 420,
    shadowColor: '#000000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  tabButton: { flex: 1 },
  badge: {
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 3,
    paddingHorizontal: 4,
    borderRadius: 18,
    // android-only quirk: a view's backgroundColor going from absent to present on an
    // already-mounted node can render square instead of picking up borderRadius on that
    // update — the isFocused ? surface : 'transparent' above (always-present value, never an
    // added/removed key) is the real fix. overflow:'hidden' is belt-and-suspenders.
    overflow: 'hidden',
  },
  // ios tab labels are caption2 (11pt)
  label: { fontSize: 10, lineHeight: 12, fontWeight: '600' },
});
