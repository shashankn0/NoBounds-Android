import type { Ionicons } from '@expo/vector-icons';

export type MiniGame = {
  id: 'tic-tac-toe' | 'spanish-flashcards' | 'japanese-flashcards' | 'draw-and-guess';
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
};

// matches playgame enum in ../nobounds/nobounds/features/play/playgame.swift
// (ios icons: grid, character.book.closed, character.ja, pencil.and.scribble — japanese and the
// pencil glyph don't exist in ionicons, so language-outline/brush-outline stand in)
export const mockGames: MiniGame[] = [
  { id: 'tic-tac-toe', title: 'Tic-Tac-Toe', subtitle: 'Classic 3×3', icon: 'grid' },
  { id: 'spanish-flashcards', title: 'Spanish Flashcards', subtitle: '180 words & phrases', icon: 'book' },
  { id: 'japanese-flashcards', title: 'Japanese Flashcards', subtitle: '180 words & phrases', icon: 'language' },
  { id: 'draw-and-guess', title: 'Draw & Guess', subtitle: 'Sketch it, pass it, guess it', icon: 'brush' },
];
