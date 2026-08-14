import type { Ionicons } from '@expo/vector-icons';

export type MiniGame = {
  id: 'tic-tac-toe' | 'spanish-flashcards' | 'japanese-flashcards' | 'draw-and-guess';
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
};

// Matches PlayGame enum in ../NoBounds/NoBounds/Features/Play/PlayGame.swift
// (iOS icons: grid, character.book.closed, character.ja, pencil.and.scribble — Japanese and the
// pencil glyph don't exist in Ionicons, so language-outline/brush-outline stand in.)
export const mockGames: MiniGame[] = [
  { id: 'tic-tac-toe', title: 'Tic-Tac-Toe', subtitle: 'Classic 3×3', icon: 'grid-outline' },
  { id: 'spanish-flashcards', title: 'Spanish Flashcards', subtitle: '180 words & phrases', icon: 'book-outline' },
  { id: 'japanese-flashcards', title: 'Japanese Flashcards', subtitle: '180 words & phrases', icon: 'language-outline' },
  { id: 'draw-and-guess', title: 'Draw & Guess', subtitle: 'Sketch it, pass it, guess it', icon: 'brush-outline' },
];

type Flashcard = { front: string; back: string };

export const mockFlashcardDecks: Record<'spanish' | 'japanese', Flashcard[]> = {
  spanish: [
    { front: 'Hola', back: 'Hello' },
    { front: 'Te extraño', back: 'I miss you' },
    { front: 'Buenas noches', back: 'Good night' },
  ],
  japanese: [
    { front: 'こんにちは', back: 'Hello' },
    { front: '会いたい', back: 'I miss you' },
    { front: 'おやすみ', back: 'Good night' },
  ],
};
