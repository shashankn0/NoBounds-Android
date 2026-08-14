import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, StyleSheet, View, type NativeSyntheticEvent, type NativeScrollEvent } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const PAGES = [
  { title: 'Stay close, no matter the distance', body: 'Share photos, prompts, and little rituals with your person — every day.' },
  { title: "One prompt a day, together", body: 'Answer a daily question and reveal each other’s answers at the same time.' },
  { title: 'A shared timeline of you two', body: 'Every memory, photo, and milestone lives in one place, just for you both.' },
];

const { width } = Dimensions.get('window');

export default function WelcomeScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [page, setPage] = useState(0);
  const listRef = useRef<FlatList>(null);

  function onScroll(e: NativeSyntheticEvent<NativeScrollEvent>) {
    const nextPage = Math.round(e.nativeEvent.contentOffset.x / width);
    setPage(nextPage);
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + Spacing.four }]}>
      <FlatList
        ref={listRef}
        data={PAGES}
        keyExtractor={(item) => item.title}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        renderItem={({ item }) => (
          <View style={[styles.page, { width }]}>
            <ThemedText type="title" style={styles.pageTitle}>
              {item.title}
            </ThemedText>
            <ThemedText type="default" themeColor="textSecondary" style={styles.pageBody}>
              {item.body}
            </ThemedText>
          </View>
        )}
      />

      <View style={styles.dots}>
        {PAGES.map((item, index) => (
          <View
            key={item.title}
            style={[
              styles.dot,
              { backgroundColor: index === page ? theme.accent : theme.surfaceElevated },
            ]}
          />
        ))}
      </View>

      <View style={[styles.actions, { paddingBottom: insets.bottom + Spacing.four }]}>
        <Pressable
          style={[styles.primaryButton, { backgroundColor: theme.accent }]}
          onPress={() => router.push('/(auth)/sign-up')}>
          <ThemedText type="default" style={styles.primaryButtonText}>
            Sign up
          </ThemedText>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => router.push('/(auth)/sign-in')}>
          <ThemedText type="default" themeColor="accent">
            I already have an account
          </ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  page: { paddingHorizontal: Spacing.four, justifyContent: 'center' },
  pageTitle: { fontSize: 32, lineHeight: 38, marginBottom: Spacing.three },
  pageBody: { fontSize: 17, lineHeight: 24 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two, marginVertical: Spacing.three },
  dot: { width: 8, height: 8, borderRadius: 4 },
  actions: { paddingHorizontal: Spacing.four, gap: Spacing.three },
  primaryButton: { paddingVertical: Spacing.three, borderRadius: 14, alignItems: 'center' },
  primaryButtonText: { color: '#ffffff', fontWeight: '600' },
  secondaryButton: { paddingVertical: Spacing.two, alignItems: 'center' },
});
