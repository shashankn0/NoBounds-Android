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
