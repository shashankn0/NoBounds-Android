import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

// read from .env.local, set at bundle time
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // warn but don't crash — app should still boot
  console.warn(
    'Missing EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY — fill in .env.local. Auth and data calls will fail until then.'
  );
}

// falls back to a placeholder so createClient doesn't throw before .env.local is filled in —
// calls will still fail, but the app can boot and show the rest of the ui.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      storage: AsyncStorage, // keeps session across app restarts
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false, // not a web oauth redirect flow
    },
  }
);

// postgrest/storage errors are plain objects, not Error instances, so `instanceof Error`
// misses them and silently falls back to a generic message — this covers both shapes
export function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object' && 'message' in err && typeof err.message === 'string') {
    return err.message;
  }
  return fallback;
}

// edge functions (create-couple-invite, accept-couple-invite, ensure-daily-prompt, ...) return
// a real {error_code, message} json body on failure, but supabase-js doesn't parse it for you —
// it's only reachable via the FunctionsHttpError's raw `context` response. falls back to
// errorMessage() for anything else (network failure, etc).
export async function functionErrorMessage(err: unknown, fallback: string): Promise<string> {
  if (err && typeof err === 'object' && 'context' in err) {
    try {
      const body = await (err as { context: Response }).context.json();
      if (body?.message) return body.message as string;
    } catch {
      // context wasn't valid json — fall through
    }
  }
  return errorMessage(err, fallback);
}
