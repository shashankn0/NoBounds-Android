import { supabase } from '@/lib/supabase';
import type { CostLevel, CoupleGiftIdea, GiftIdeaTemplate, GiftKind, GiftRecipient } from '@/lib/database-types';

export async function fetchGiftIdeaTemplates(): Promise<GiftIdeaTemplate[]> {
  const { data, error } = await supabase
    .from('gift_idea_templates')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as GiftIdeaTemplate[]) ?? [];
}

// newest first — matches ios's fetchCoupleIdeas so a just-created idea shows up top of "Yours"
export async function fetchCoupleGiftIdeas(coupleId: string): Promise<CoupleGiftIdea[]> {
  const { data, error } = await supabase
    .from('couple_gift_ideas')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as CoupleGiftIdea[]) ?? [];
}

export async function createGiftIdea(
  coupleId: string,
  fields: { title: string; summary: string; kind: GiftKind; recipient: GiftRecipient; costLevel: CostLevel }
): Promise<CoupleGiftIdea> {
  const { data: userData } = await supabase.auth.getUser();
  const createdBy = userData.user?.id;
  if (!createdBy) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('couple_gift_ideas')
    .insert({
      couple_id: coupleId,
      created_by: createdBy,
      title: fields.title,
      summary: fields.summary,
      kind: fields.kind,
      recipient: fields.recipient,
      cost_level: fields.costLevel,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as CoupleGiftIdea;
}

export async function deleteGiftIdea(id: string): Promise<void> {
  const { error } = await supabase.from('couple_gift_ideas').delete().eq('id', id);
  if (error) throw error;
}
