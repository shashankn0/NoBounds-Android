import AsyncStorage from '@react-native-async-storage/async-storage';

// mirrors ios's ExtensionsView: which optional home cards are on, and in what order. purely
// local/per-device UI state (ios uses @AppStorage/UserDefaults) — never synced to the backend,
// so each partner can have their own home layout.
export type ExtensionId = 'date-ideas' | 'gifts' | 'weekly-share' | 'habits' | 'pet' | 'cycle-tracking';

export const EXTENSION_IDS: ExtensionId[] = ['date-ideas', 'gifts', 'weekly-share', 'habits', 'pet', 'cycle-tracking'];

export const DEFAULT_EXTENSION_ENABLED: Record<ExtensionId, boolean> = {
  'date-ideas': false,
  gifts: false,
  'weekly-share': false,
  habits: true,
  pet: true,
  'cycle-tracking': true,
};

const ENABLED_KEY = 'extension_enabled_v1';
const ORDER_KEY = 'extension_order_v1';

function isExtensionId(value: string): value is ExtensionId {
  return (EXTENSION_IDS as string[]).includes(value);
}

export async function loadExtensionEnabled(): Promise<Record<ExtensionId, boolean>> {
  const stored = await AsyncStorage.getItem(ENABLED_KEY);
  if (!stored) return DEFAULT_EXTENSION_ENABLED;
  try {
    const parsed = JSON.parse(stored) as Partial<Record<ExtensionId, boolean>>;
    return { ...DEFAULT_EXTENSION_ENABLED, ...parsed };
  } catch {
    return DEFAULT_EXTENSION_ENABLED;
  }
}

export async function saveExtensionEnabled(enabled: Record<ExtensionId, boolean>): Promise<void> {
  await AsyncStorage.setItem(ENABLED_KEY, JSON.stringify(enabled));
}

export async function loadExtensionOrder(): Promise<ExtensionId[]> {
  const stored = await AsyncStorage.getItem(ORDER_KEY);
  if (!stored) return EXTENSION_IDS;
  try {
    const parsed = (JSON.parse(stored) as string[]).filter(isExtensionId);
    const missing = EXTENSION_IDS.filter((id) => !parsed.includes(id));
    return [...parsed, ...missing];
  } catch {
    return EXTENSION_IDS;
  }
}

export async function saveExtensionOrder(order: ExtensionId[]): Promise<void> {
  await AsyncStorage.setItem(ORDER_KEY, JSON.stringify(order));
}
