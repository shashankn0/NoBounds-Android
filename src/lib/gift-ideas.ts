import { supabase } from '@/lib/supabase';
import type { CoupleGiftIdea, GiftIdeaTemplate } from '@/lib/database-types';

export async function fetchGiftIdeaTemplates(): Promise<GiftIdeaTemplate[]> {
  const { data, error } = await supabase.from('gift_idea_templates').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as GiftIdeaTemplate[]) ?? [];
}

export async function fetchCoupleGiftIdeas(coupleId: string): Promise<CoupleGiftIdea[]> {
  const { data, error } = await supabase.from('couple_gift_ideas').select('*').eq('couple_id', coupleId);
  if (error) throw error;
  return (data as CoupleGiftIdea[]) ?? [];
}
