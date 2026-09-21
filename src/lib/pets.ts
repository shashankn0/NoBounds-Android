import { supabase } from '@/lib/supabase';
import type { PetMessage, UserPet } from '@/lib/database-types';

const PET_COLUMNS = 'id, user_id, couple_id, species_key, name, bio, last_fed_at, last_played_at, created_at, updated_at';

// both partners' pets — one row per person, real table enforces one pet per user
export async function fetchPets(coupleId: string): Promise<UserPet[]> {
  const { data, error } = await supabase.from('user_pets').select(PET_COLUMNS).eq('couple_id', coupleId);
  if (error) throw error;
  return (data as UserPet[]) ?? [];
}

export async function fetchPetMessages(coupleId: string): Promise<PetMessage[]> {
  const { data, error } = await supabase
    .from('pet_messages')
    .select('id, couple_id, sender_user_id, text, created_at')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as PetMessage[]) ?? [];
}

export async function sendPetMessage(coupleId: string, text: string): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const senderUserId = userData.user?.id;
  if (!senderUserId) throw new Error('Not signed in');

  const { error } = await supabase.from('pet_messages').insert({ couple_id: coupleId, sender_user_id: senderUserId, text });
  if (error) throw error;
  // sending a message means you're here right now — keep your pet awake on your partner's screen
  markAppOpened(senderUserId);
}

// port of PetPresenceRule (core/domain/pet/petmood.swift): a partner's pet naps when its owner
// hasn't opened the app in over 2 hours, or has never recorded an open
const NAP_THRESHOLD_MS = 2 * 60 * 60 * 1000;

export function isPresenceNapping(lastOpenedAt: string | null, now: number = Date.now()): boolean {
  if (!lastOpenedAt) return true;
  return now - new Date(lastOpenedAt).getTime() > NAP_THRESHOLD_MS;
}

// ios's PetRepository.markAppOpened: stamps profiles.last_opened_at (profiles_update_own covers
// the write). ios reads this column for its play area, so without it the Android user's pet
// always looked asleep on the iOS side. best-effort, failures are ignored
export async function markAppOpened(userId: string): Promise<void> {
  await supabase.from('profiles').update({ last_opened_at: new Date().toISOString() }).eq('id', userId);
}

// the partner's last app open (profiles_select_partner lets you read your partner's row)
export async function fetchLastOpenedAt(userId: string): Promise<string | null> {
  const { data, error } = await supabase.from('profiles').select('last_opened_at').eq('id', userId).maybeSingle();
  if (error) throw error;
  return (data as { last_opened_at: string | null } | null)?.last_opened_at ?? null;
}

// either partner can feed/play with a couple pet — matches the real record_pet_care(...) rpc
export async function recordPetCare(petId: string, action: 'feed' | 'play'): Promise<string> {
  const { data, error } = await supabase.rpc('record_pet_care', { p_pet_id: petId, p_action: action });
  if (error) throw error;
  return data as string;
}

// port of core/domain/pet/petmood.swift — purely client-computed linear decay, no server ticking job.
// fullness decays to 0 over 24h since last_fed_at, happiness over 12h since last_played_at.
const FULLNESS_WINDOW_MS = 24 * 60 * 60 * 1000;
const HAPPINESS_WINDOW_MS = 12 * 60 * 60 * 1000;

function meterSince(isoDate: string | null, windowMs: number): number {
  if (!isoDate) return 0;
  const elapsed = Date.now() - new Date(isoDate).getTime();
  if (elapsed <= 0) return 1;
  return Math.max(0, 1 - elapsed / windowMs);
}

export function petMood(pet: UserPet): { fullness: number; happiness: number } {
  return {
    fullness: meterSince(pet.last_fed_at, FULLNESS_WINDOW_MS),
    happiness: meterSince(pet.last_played_at, HAPPINESS_WINDOW_MS),
  };
}
