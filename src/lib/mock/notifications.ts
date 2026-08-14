export type MockNotification = {
  id: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
};

export const mockNotifications: MockNotification[] = [
  { id: 'n-1', title: 'New prompt answer', body: 'Your partner answered today\'s prompt.', read: false, createdAt: new Date().toISOString() },
  { id: 'n-2', title: 'New memory', body: 'A new memory was added to your timeline.', read: true, createdAt: new Date().toISOString() },
];
