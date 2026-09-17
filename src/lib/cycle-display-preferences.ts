import AsyncStorage from '@react-native-async-storage/async-storage';

// mirrors ios's CycleDisplayPreferenceStore: device-local display prefs for the cycle dashboard.
// never synced to the backend or visible to a partner — separate from cycle_sharing_permissions,
// which controls what the PARTNER can see.
const HIDE_MY_CYCLE_KEY = 'cycle_display_hide_my_cycle';
const PARTNER_CYCLE_FIRST_KEY = 'cycle_display_partner_cycle_first';

async function loadBool(key: string): Promise<boolean> {
  const stored = await AsyncStorage.getItem(key);
  return stored === 'true';
}

async function saveBool(key: string, value: boolean): Promise<void> {
  await AsyncStorage.setItem(key, value ? 'true' : 'false');
}

export const loadHideMyCycle = () => loadBool(HIDE_MY_CYCLE_KEY);
export const saveHideMyCycle = (value: boolean) => saveBool(HIDE_MY_CYCLE_KEY, value);
export const loadPartnerCycleFirst = () => loadBool(PARTNER_CYCLE_FIRST_KEY);
export const savePartnerCycleFirst = (value: boolean) => saveBool(PARTNER_CYCLE_FIRST_KEY, value);
