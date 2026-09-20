import { router } from 'expo-router';

// mirrors core/navigation/notificationrouter.swift's route(for:payload:) — maps each
// notification type + its payload to the in-app screen that best matches it. shared by the
// in-app inbox and by taps on system (push) notifications.
export function routeForNotification(type: string, payload: Record<string, unknown> | null | undefined) {
  const data = payload ?? {};
  const photoId = typeof data.photo_id === 'string' ? data.photo_id : undefined;
  const habitId = typeof data.habit_id === 'string' ? data.habit_id : undefined;

  switch (type) {
    case 'presence_new_photo':
    case 'reaction_photo':
      if (photoId) router.push({ pathname: '/photo-detail', params: { photoId } });
      break;
    case 'prompt_unanswered':
    case 'reaction_prompt':
      router.push('/prompt');
      break;
    case 'habit_reminder':
      if (habitId) router.push({ pathname: '/habit-detail', params: { habitId } });
      break;
    case 'habit_missed_digest':
      router.push('/');
      break;
    case 'milestone':
      router.push('/timeline');
      break;
    case 'reunion_countdown':
      router.push('/');
      break;
    case 'cycle_heads_up':
    case 'cycle_symptom_sos':
      router.push('/cycle-tracking');
      break;
    case 'pet_activity':
      router.push('/play');
      break;
    default:
      break;
  }
}
