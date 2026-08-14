export type GiftIdea = {
  id: string;
  title: string;
  recipient: 'me' | 'partner';
  starred: boolean;
};

export const mockGiftIdeas: GiftIdea[] = [
  { id: 'gi-1', title: 'That book she mentioned last week', recipient: 'partner', starred: true },
  { id: 'gi-2', title: 'Handwritten letter for our anniversary', recipient: 'partner', starred: false },
  { id: 'gi-3', title: 'Noise-cancelling headphones', recipient: 'me', starred: false },
];
