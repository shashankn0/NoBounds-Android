export type MockPresencePhoto = {
  id: string;
  caption: string;
  mood: string;
  createdAt: string;
};

// placeholder data — real presence photos need live camera capture, not built yet
export const mockPresencePhotos: MockPresencePhoto[] = [
  { id: 'p-1', caption: 'Coffee before work ☕', mood: 'cozy', createdAt: new Date().toISOString() },
  { id: 'p-2', caption: 'This sunset stopped me in my tracks', mood: 'peaceful', createdAt: new Date().toISOString() },
];
