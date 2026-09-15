import { supabase } from '@/lib/supabase';
import type { FlashcardCard, FlashcardDeck, FlashcardLanguage, FlashcardMastery, FlashcardProgress } from '@/lib/database-types';

export async function fetchDecks(language?: FlashcardLanguage): Promise<FlashcardDeck[]> {
  let query = supabase.from('flashcard_decks').select('*').order('sort_order', { ascending: true });
  if (language) query = query.eq('language_key', language);
  const { data, error } = await query;
  if (error) throw error;
  return (data as FlashcardDeck[]) ?? [];
}

export async function fetchCards(deckId: string): Promise<FlashcardCard[]> {
  const { data, error } = await supabase
    .from('flashcard_cards')
    .select('*')
    .eq('deck_id', deckId)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as FlashcardCard[]) ?? [];
}

export async function fetchProgress(): Promise<FlashcardProgress[]> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { data, error } = await supabase.from('flashcard_progress').select('*').eq('user_id', userId);
  if (error) throw error;
  return (data as FlashcardProgress[]) ?? [];
}

// review_count is passed in rather than incremented server-side: the caller already tracks it
// locally (it drives the study-queue weighting), so this avoids a read-modify-write race between
// rapid rating taps. Matches iOS: reviewCount only ever moves in mark(), never in toggleStar().
export async function updateCardProgress(
  cardId: string,
  mastery: FlashcardMastery,
  isStarred: boolean,
  reviewCount: number
): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { error } = await supabase.from('flashcard_progress').upsert(
    {
      user_id: userId,
      card_id: cardId,
      mastery,
      is_starred: isStarred,
      review_count: reviewCount,
      last_reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,card_id' }
  );
  if (error) throw error;
}
