import AsyncStorage from '@react-native-async-storage/async-storage';

// mirrors ios's ProfileAvatarSource: which of the two paired partners' photos represents "you"
// around the app (header avatar, profile screen). purely local/per-device UI state, stored in
// AsyncStorage the same way ios stores it in UserDefaults — never synced to the backend, and not
// shared with the partner's device.
export type AvatarSource = 'mine' | 'partner';

const STORAGE_KEY = 'profile_avatar_source';

export async function loadAvatarSource(): Promise<AvatarSource> {
  const stored = await AsyncStorage.getItem(STORAGE_KEY);
  return stored === 'partner' ? 'partner' : 'mine';
}

export async function saveAvatarSource(source: AvatarSource): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, source);
}
