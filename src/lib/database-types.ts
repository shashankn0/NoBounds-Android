// row types for every table on the real nobounds backend (source: ../nobounds/supabase/migrations),
// not just the ones the app currently has screens for. kept in one file as a single source of
// truth for what the real schema actually looks like, grouped in the same order as the
// migrations that created them. see src/lib/*.ts for the fetch/write functions that use these.

// ============ core accounts ============
export type Profile = {
  id: string;
  display_name: string | null;
  avatar_url: string | null;
  time_zone: string | null;
  created_at: string;
  updated_at: string;
  last_opened_at: string | null;
};

export type UserAppSettings = {
  user_id: string;
  palette_id: string;
  appearance_mode: 'system' | 'light' | 'dark';
  quiet_hours_start: number | null;
  quiet_hours_end: number | null;
  created_at: string;
  updated_at: string;
};

// ============ pairing ============
export type CoupleInviteStatus = 'pending' | 'accepted' | 'expired' | 'revoked' | 'superseded';

export type Couple = {
  id: string;
  reunion_start_date: string | null;
  reunion_end_date: string | null;
  created_at: string;
  updated_at: string;
};

export type CoupleMember = {
  id: string;
  couple_id: string;
  user_id: string;
  role: string;
  joined_at: string;
};

export type CoupleInvite = {
  id: string;
  code: string;
  inviter_user_id: string;
  couple_id: string | null;
  status: CoupleInviteStatus;
  expires_at: string;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
};

// couple_merge_runs: service-role only, no client select policy — type kept for completeness only

// ============ habits ============
export type HabitOwnerScope = 'mine' | 'yours' | 'ours';
export type HabitCompletionPolicy = 'either' | 'both';
export type HabitKind = 'standard' | 'weeks_bound' | 'bound_streak';

export type Habit = {
  id: string;
  couple_id: string | null;
  owner_user_id: string;
  title: string;
  owner_scope: HabitOwnerScope;
  completion_policy: HabitCompletionPolicy;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  merged_at: string | null;
  habit_kind: HabitKind;
  reminder_hour: number | null;
};

export type HabitCompletion = {
  id: string;
  habit_id: string;
  user_id: string;
  completion_date: string;
  completed: boolean;
  updated_at: string;
  linked_memory_id: string | null;
};

// ============ timeline ============
export type TimelineMemory = {
  id: string;
  couple_id: string | null;
  owner_user_id: string;
  title: string;
  body: string | null;
  occurred_on: string;
  created_at: string;
  merged_at: string | null;
};

export type TimelineMemoryPhoto = {
  id: string;
  memory_id: string;
  storage_path: string;
  sort_order: number;
  created_at: string;
};

export type SoloPromptEntry = {
  id: string;
  couple_id: string | null;
  owner_user_id: string;
  entry_date: string;
  body: string;
  created_at: string;
  merged_at: string | null;
};

export type TimelineFavorite = {
  id: string;
  user_id: string;
  entity_type: 'memory' | 'gratitude' | 'photo' | 'prompt' | 'milestone';
  entity_id: string;
  created_at: string;
};

export type TimelineMilestone = {
  id: string;
  couple_id: string;
  milestone_key: string;
  title: string;
  body: string | null;
  occurred_at: string;
  metadata: Record<string, unknown>;
  created_by_user_id: string | null;
  created_at: string;
};

// row shape returned by the real timeline_feed(...) rpc
export type TimelineFeedRow = {
  item_type: 'memory' | 'gratitude' | 'photo' | 'prompt' | 'milestone';
  item_id: string;
  occurred_at: string;
  title: string | null;
  subtitle: string | null;
  entity_type: string;
  entity_id: string;
  is_favorite: boolean;
  metadata: Record<string, unknown>;
  cursor_occurred_at: string;
  cursor_item_id: string;
};

// ============ daily prompts ============
export type PromptTemplate = {
  id: string;
  body: string;
  category: string | null;
  active: boolean;
  created_at: string;
};

export type CoupleDailyPrompt = {
  id: string;
  couple_id: string;
  prompt_date: string;
  template_id: string | null;
  custom_body: string | null;
  timezone: string;
  created_at: string;
};

export type PromptAnswer = {
  id: string;
  couple_daily_prompt_id: string;
  user_id: string;
  body: string;
  photo_storage_path: string | null;
  submitted_at: string;
  client_idempotency_key: string | null;
};

export type PromptReaction = {
  id: string;
  prompt_answer_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

export type PromptReply = {
  id: string;
  prompt_answer_id: string;
  parent_reply_id: string | null;
  user_id: string;
  body: string;
  created_at: string;
};

export type PromptMessage = {
  id: string;
  couple_daily_prompt_id: string;
  user_id: string;
  body: string;
  created_at: string;
};

// view: metadata-only per-answer row (no body) for "waiting on partner" ui
export type PromptAnswerSlot = {
  couple_daily_prompt_id: string;
  user_id: string;
  submitted_at: string;
  has_media: boolean;
};

// view: joined summary used by timeline_feed for the 'prompt' item type
export type CoupleDailyPromptFeedRow = {
  id: string;
  couple_id: string;
  prompt_date: string;
  timezone: string;
  created_at: string;
  body: string;
  answer_count: number;
  is_revealed: boolean;
};

// ============ presence / bound ============
export type PresenceCaptureSource = 'camera' | 'library';

export type PresencePhoto = {
  id: string;
  couple_id: string;
  user_id: string;
  storage_path: string;
  caption: string | null;
  mood_tag: string | null;
  location_label: string | null;
  created_at: string;
  client_idempotency_key: string | null;
  capture_source: PresenceCaptureSource;
};

// cache table, trigger-maintained — select-only for clients, never written to directly
export type CouplePresenceLatest = {
  couple_id: string;
  user_id: string;
  photo_id: string;
  updated_at: string;
};

export type PresenceReaction = {
  id: string;
  photo_id: string;
  user_id: string;
  emoji: string;
  created_at: string;
};

// ============ notifications ============
export type NotificationType =
  | 'prompt_unanswered'
  | 'presence_new_photo'
  | 'reaction_photo'
  | 'reaction_prompt'
  | 'habit_reminder'
  | 'milestone'
  | 'reunion_countdown'
  | 'habit_missed_digest'
  | 'cycle_heads_up'
  | 'cycle_symptom_sos'
  | 'pet_activity';

export type NotificationPreference = {
  id: string;
  user_id: string;
  notification_type: string;
  enabled: boolean;
  updated_at: string;
};

export type AppNotification = {
  id: string;
  user_id: string;
  couple_id: string | null;
  notification_type: string;
  title: string;
  body: string;
  payload: Record<string, unknown>;
  read_at: string | null;
  idempotency_key: string;
  created_at: string;
};

// apns-only on the real backend — there is no fcm/android column here yet, so this table
// can't actually register an android push token as-is (see the android push-notifications plan)
export type PushDeviceToken = {
  id: string;
  user_id: string;
  device_id: string;
  apns_token: string;
  platform: string;
  updated_at: string;
};

// ============ pets / play area ============
export type UserPet = {
  id: string;
  user_id: string;
  couple_id: string;
  species_key: string;
  name: string;
  bio: string | null;
  last_fed_at: string | null;
  last_played_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PetMessage = {
  id: string;
  couple_id: string;
  sender_user_id: string;
  text: string;
  created_at: string;
};

// ============ cycle tracking ============
// exact values confirmed against the real check constraint + matching swift enums —
// see supabase/migrations/20260625140000_cycle_tracking.sql and core/domain/cycletracking/cyclemodels.swift
export type CycleFlowLevel = 'none' | 'light' | 'medium' | 'heavy';
export type CycleMood = 'happy' | 'calm' | 'anxious' | 'irritable' | 'sad' | 'energetic' | 'tired';
export type CycleSymptomType =
  | 'cramps'
  | 'headache'
  | 'migraine'
  | 'bloating'
  | 'nausea'
  | 'back_pain'
  | 'breast_tenderness'
  | 'fatigue';
export type CycleSymptomSeverity = 'mild' | 'moderate' | 'severe';
export type CycleSymptom = { type: CycleSymptomType; severity: CycleSymptomSeverity };

export type CycleTrackingProfile = {
  user_id: string;
  couple_id: string;
  opted_in_at: string;
  sharing_enabled: boolean;
  unlinked_at: string | null;
  avg_cycle_length_days: number;
  avg_period_length_days: number;
  created_at: string;
  updated_at: string;
};

export type CycleSharingPermissions = {
  user_id: string;
  share_period_dates: boolean;
  share_flow_details: boolean;
  share_moods: boolean;
  share_symptoms: boolean;
  share_phase: boolean;
  updated_at: string;
};

export type CyclePeriodLog = {
  id: string;
  user_id: string;
  couple_id: string;
  period_start_date: string;
  period_length_days: number | null;
};

export type CycleDailyEntry = {
  id: string;
  user_id: string;
  couple_id: string;
  entry_date: string;
  mood: CycleMood | null;
  flow_level: CycleFlowLevel | null;
  symptoms: CycleSymptom[];
  created_at: string;
  updated_at: string;
};

// masked partner-read row shape from the cycle_partner_daily_entries(...) rpc — fields the
// owner hasn't shared come back null rather than being filtered out row-by-row
export type CyclePartnerDailyEntry = CycleDailyEntry;

// ============ feedback / analytics (both write-only from the client — no select policy) ============
export type UserFeedback = {
  id: string;
  user_id: string;
  couple_id: string | null;
  kind: 'feedback' | 'bug_report';
  message: string;
  app_version: string | null;
  os_version: string | null;
  device_model: string | null;
  created_at: string;
};

export type FunnelEventName =
  | 'sign_up'
  | 'sign_in'
  | 'pair_success'
  | 'prompt_answer'
  | 'presence_upload'
  | 'habit_toggle';

export type FunnelEvent = {
  id: string;
  user_id: string;
  event_name: FunnelEventName;
  properties: Record<string, unknown>;
  app_version: string | null;
  os_version: string | null;
  device_model: string | null;
  environment: string;
  created_at: string;
};

// ============ flashcards ============
export type FlashcardLanguage = 'spanish' | 'japanese';
export type FlashcardMastery = 'new' | 'practice' | 'solid';

export type FlashcardDeck = {
  id: string;
  language_key: FlashcardLanguage;
  title: string;
  subtitle: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type FlashcardCard = {
  id: string;
  deck_id: string;
  front_text: string;
  back_text: string;
  reading_text: string | null;
  sort_order: number;
  active: boolean;
  created_at: string;
};

export type FlashcardProgress = {
  user_id: string;
  card_id: string;
  mastery: FlashcardMastery;
  is_starred: boolean;
  review_count: number;
  last_reviewed_at: string | null;
  updated_at: string;
};

// ============ date ideas ============
export type DateIdeaCategory = 'food' | 'adventure' | 'cozy' | 'creative' | 'games';
export type DateIdeaMode = 'virtual' | 'in_person';
export type CostLevel = 'free' | 'low' | 'medium' | 'high';
export type DateIdeaSetting = 'indoor' | 'outdoor' | 'either';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'any';

export type DateIdeaTemplate = {
  id: string;
  title: string;
  summary: string | null;
  category: DateIdeaCategory;
  mode: DateIdeaMode;
  cost_level: CostLevel;
  duration_minutes: number;
  setting: DateIdeaSetting;
  time_of_day: TimeOfDay;
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type CoupleDateIdea = {
  id: string;
  couple_id: string;
  created_by: string;
  title: string;
  summary: string | null;
  category: DateIdeaCategory;
  mode: DateIdeaMode;
  cost_level: CostLevel;
  duration_minutes: number | null;
  setting: DateIdeaSetting | null;
  time_of_day: TimeOfDay | null;
  created_at: string;
  updated_at: string;
};

// exactly one of template_id/couple_idea_id is set — a star against either a curated or
// couple-authored idea
export type DateIdeaStar = {
  id: string;
  couple_id: string;
  user_id: string;
  template_id: string | null;
  couple_idea_id: string | null;
};

// ============ important dates ============
export type ImportantDate = {
  id: string;
  couple_id: string | null;
  owner_user_id: string;
  title: string;
  description: string | null;
  event_date: string;
  repeats_yearly: boolean;
  created_at: string;
  updated_at: string;
  merged_at: string | null;
};

// ============ gift ideas ============
export type GiftKind = 'gift' | 'act_of_service';
export type GiftRecipient = 'boy' | 'girl' | 'other';

export type GiftIdeaTemplate = {
  id: string;
  title: string;
  summary: string | null;
  kind: GiftKind;
  recipient: GiftRecipient;
  cost_level: CostLevel;
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type CoupleGiftIdea = {
  id: string;
  couple_id: string;
  created_by: string;
  title: string;
  summary: string | null;
  kind: GiftKind;
  recipient: GiftRecipient;
  cost_level: CostLevel;
  created_at: string;
  updated_at: string;
};

// ============ weekly share ============
export type WeeklyShareKind = 'message' | 'quote' | 'link';

export type WeeklyShareQuote = {
  id: string;
  body: string;
  author: string | null;
  active: boolean;
  sort_order: number;
  created_at: string;
};

export type CoupleWeeklyShare = {
  id: string;
  couple_id: string;
  created_by: string;
  week_start: string;
  kind: WeeklyShareKind;
  body: string;
  url: string | null;
  created_at: string;
  updated_at: string;
};
