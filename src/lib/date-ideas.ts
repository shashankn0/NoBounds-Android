import { supabase } from '@/lib/supabase';
import type { CoupleDateIdea, DateIdeaStar, DateIdeaTemplate } from '@/lib/database-types';

// curated catalog, shared across every couple
export async function fetchDateIdeaTemplates(): Promise<DateIdeaTemplate[]> {
  const { data, error } = await supabase.from('date_idea_templates').select('*').order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as DateIdeaTemplate[]) ?? [];
}

// this couple's own added ideas
export async function fetchCoupleDateIdeas(coupleId: string): Promise<CoupleDateIdea[]> {
  const { data, error } = await supabase.from('couple_date_ideas').select('*').eq('couple_id', coupleId);
  if (error) throw error;
  return (data as CoupleDateIdea[]) ?? [];
}

export async function fetchStars(coupleId: string): Promise<DateIdeaStar[]> {
  const { data, error } = await supabase.from('date_idea_stars').select('*').eq('couple_id', coupleId);
  if (error) throw error;
  return (data as DateIdeaStar[]) ?? [];
}

// exactly one of templateId/coupleIdeaId should be passed
export async function starDateIdea(coupleId: string, templateId: string | null, coupleIdeaId: string | null): Promise<void> {
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) throw new Error('Not signed in');

  const { error } = await supabase
    .from('date_idea_stars')
    .insert({ couple_id: coupleId, user_id: userId, template_id: templateId, couple_idea_id: coupleIdeaId });
  if (error) throw error;
}

export async function unstarDateIdea(starId: string): Promise<void> {
  const { error } = await supabase.from('date_idea_stars').delete().eq('id', starId);
  if (error) throw error;
}
