import { File } from 'expo-file-system';

import { supabase } from '@/lib/supabase';

const SIGNED_URL_TTL_SECONDS = 3600; // links expire after 1 hour

// uploads to a private bucket — path must match that bucket's rls ownership rule.
// reads the local file straight into an arraybuffer via expo-file-system, rather than
// fetch(uri).blob() — react native's Blob polyfill round-trips the bytes through base64
// and its own native store, which is slow and also loses the real mime type along the way.
export async function uploadPrivate(bucket: string, path: string, uri: string, contentType: string): Promise<void> {
  const arrayBuffer = await new File(uri).arrayBuffer();
  const { error } = await supabase.storage.from(bucket).upload(path, arrayBuffer, { contentType });
  if (error) throw error;
}

// resolves one file to a short-lived, viewable url
export async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error) return null;
  return data?.signedUrl ?? null;
}

// batch version — one request for many paths, used when resolving thumbnails for a whole feed page.
export async function getSignedUrls(bucket: string, paths: string[]): Promise<Record<string, string>> {
  if (paths.length === 0) return {};
  const { data, error } = await supabase.storage.from(bucket).createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
  if (error || !data) return {};

  // map path -> signed url for easy lookup
  const result: Record<string, string> = {};
  for (const entry of data) {
    if (entry.signedUrl && entry.path) {
      result[entry.path] = entry.signedUrl;
    }
  }
  return result;
}
