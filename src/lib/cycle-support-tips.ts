import type { CycleMood } from '@/lib/database-types';
import type { CyclePhase } from '@/lib/cycle-tracking';

// port of core/domain/cycletracking/cyclesupporttipscatalog.swift — verbatim copy, so partners
// on either platform see the same phase-specific advice and mood explanations
export function cycleSupportTips(phase: CyclePhase): string[] {
  switch (phase) {
    case 'menstrual':
      return [
        'Bring a heating pad or warm drink today.',
        'Offer to handle a chore they usually manage.',
        'Keep plans flexible — low energy is normal now.',
      ];
    case 'follicular':
      return [
        'Energy is often rising — plan something fun together.',
        'A walk or light workout can feel especially good now.',
        'This is a great time for bigger conversations.',
      ];
    case 'ovulation':
      return [
        'Libido and confidence may peak — be present and affectionate.',
        'Stay hydrated and prioritize sleep.',
        'Celebrate small wins together today.',
      ];
    case 'luteal':
      return [
        'PMS may start soon — extra patience goes a long way.',
        'Stock comfort snacks and reduce last-minute plans.',
        'Ask how you can help before problems feel urgent.',
      ];
  }
}

export function cycleMoodExplanation(mood: CycleMood): string {
  switch (mood) {
    case 'happy':
      return 'Estrogen rising in the follicular phase often boosts serotonin and mood.';
    case 'calm':
      return 'Stable hormone levels can support a relaxed, balanced mood.';
    case 'anxious':
      return 'Progesterone shifts in the luteal phase can increase anxiety sensitivity.';
    case 'irritable':
      return 'Dropping estrogen before a period can lower stress tolerance.';
    case 'sad':
      return 'Hormonal changes can temporarily affect dopamine and mood regulation.';
    case 'energetic':
      return 'Peak estrogen around ovulation often increases energy and motivation.';
    case 'tired':
      return 'Progesterone has a calming, sedating effect that can feel like fatigue.';
  }
}

// port of features/cycletracking/cycletrackingcopy.swift
export const CYCLE_MEDICAL_DISCLAIMER =
  'Track your cycle privately and choose exactly what your partner can see. This is not medical advice — consult a healthcare provider for health decisions.';
