export type Pet = {
  id: string;
  name: string;
  species: 'cat' | 'dog' | 'bird';
  mood: 'happy' | 'sleepy' | 'playful';
  level: number;
};

export const mockPet: Pet = {
  id: 'pet-1',
  name: 'Mochi',
  species: 'cat',
  mood: 'happy',
  level: 3,
};

export const petMoodEmoji: Record<Pet['mood'], string> = {
  happy: '😻',
  sleepy: '😴',
  playful: '🐾',
};
