export type DateIdea = {
  id: string;
  title: string;
  mode: 'virtual' | 'in_person';
  starred: boolean;
};

export const mockDateIdeas: DateIdea[] = [
  { id: 'di-1', title: 'Watch a movie together over a call', mode: 'virtual', starred: true },
  { id: 'di-2', title: 'Cook the same recipe at the same time', mode: 'virtual', starred: false },
  { id: 'di-3', title: 'Picnic when we\'re next together', mode: 'in_person', starred: true },
  { id: 'di-4', title: 'Send each other a mystery playlist', mode: 'virtual', starred: false },
];
