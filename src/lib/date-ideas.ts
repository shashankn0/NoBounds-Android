import { supabase } from '@/lib/supabase';
import type { CostLevel, CoupleDateIdea, DateIdeaCategory, DateIdeaMode, DateIdeaSetting, DateIdeaStar, DateIdeaTemplate, TimeOfDay } from '@/lib/database-types';

// curated catalog, shared across every couple
export async function fetchDateIdeaTemplates(): Promise<DateIdeaTemplate[]> {
  const { data, error } = await supabase
    .from('date_idea_templates')
    .select('*')
    .eq('active', true)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return (data as DateIdeaTemplate[]) ?? [];
}

// newest first — matches ios's fetchCoupleIdeas so a just-created idea shows up top of "Yours"
export async function fetchCoupleDateIdeas(coupleId: string): Promise<CoupleDateIdea[]> {
  const { data, error } = await supabase
    .from('couple_date_ideas')
    .select('*')
    .eq('couple_id', coupleId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as CoupleDateIdea[]) ?? [];
}

export async function createDateIdea(
  coupleId: string,
  fields: {
    title: string;
    summary: string;
    category: DateIdeaCategory;
    mode: DateIdeaMode;
    costLevel: CostLevel;
    durationMinutes: number;
    setting: DateIdeaSetting;
    timeOfDay: TimeOfDay;
  }
): Promise<CoupleDateIdea> {
  const { data: userData } = await supabase.auth.getUser();
  const createdBy = userData.user?.id;
  if (!createdBy) throw new Error('Not signed in');

  const { data, error } = await supabase
    .from('couple_date_ideas')
    .insert({
      couple_id: coupleId,
      created_by: createdBy,
      title: fields.title,
      summary: fields.summary,
      category: fields.category,
      mode: fields.mode,
      cost_level: fields.costLevel,
      duration_minutes: fields.durationMinutes,
      setting: fields.setting,
      time_of_day: fields.timeOfDay,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as CoupleDateIdea;
}

export async function deleteDateIdea(id: string): Promise<void> {
  const { error } = await supabase.from('couple_date_ideas').delete().eq('id', id);
  if (error) throw error;
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
