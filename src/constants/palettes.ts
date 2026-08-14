export type PaletteId = 'classic_rose' | 'ocean_calm' | 'evergreen' | 'lavender_dusk' | 'paper_minimal';

export type PaletteColors = {
  background: string;
  backgroundSecondary: string;
  surface: string;
  surfaceElevated: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  textOnAccent: string;
  accentMuted: string;
  destructive: string;
  border: string;
  separator: string;
  tabBarBackground: string;
  tabBarItemSelected: string;
  tabBarItemUnselected: string;
};

export type Palette = {
  id: PaletteId;
  name: string;
  light: PaletteColors;
  dark: PaletteColors;
};

// Exact token values ported from ../NoBounds/NoBounds/Core/Theme/Palettes/*Tokens.swift
export const Palettes: Record<PaletteId, Palette> = {
  classic_rose: {
    id: 'classic_rose',
    name: 'Classic Rose',
    light: {
      background: '#F6EFEA',
      backgroundSecondary: '#F3E9E3',
      surface: '#FFFFFF',
      surfaceElevated: '#FAF5F1',
      textPrimary: '#2C2421',
      textSecondary: '#6B5C55',
      accent: '#A16654',
      textOnAccent: '#FFFFFF',
      accentMuted: '#D89A84',
      destructive: '#B4423A',
      border: '#E5D5CC',
      separator: '#EBDDD4',
      tabBarBackground: '#FAF5F1',
      tabBarItemSelected: '#A16654',
      tabBarItemUnselected: '#7C6D66',
    },
    dark: {
      background: '#1A1614',
      backgroundSecondary: '#221E1C',
      surface: '#2A2522',
      surfaceElevated: '#322C28',
      textPrimary: '#F2EEEB',
      textSecondary: '#A89F98',
      accent: '#D9907A',
      textOnAccent: '#FFFFFF',
      accentMuted: '#C88A78',
      destructive: '#E05A52',
      border: '#3D3530',
      separator: '#352F2B',
      tabBarBackground: '#221E1C',
      tabBarItemSelected: '#D9907A',
      tabBarItemUnselected: '#8A8078',
    },
  },
  ocean_calm: {
    id: 'ocean_calm',
    name: 'Ocean Calm',
    light: {
      background: '#EDF2F7',
      backgroundSecondary: '#E0E9F1',
      surface: '#FFFFFF',
      surfaceElevated: '#F4F9FC',
      textPrimary: '#152E3C',
      textSecondary: '#526A7A',
      accent: '#1B8097',
      textOnAccent: '#FFFFFF',
      accentMuted: '#4DADC4',
      destructive: '#C0392B',
      border: '#C8D8E6',
      separator: '#D4E2ED',
      tabBarBackground: '#F4F9FC',
      tabBarItemSelected: '#1B8097',
      tabBarItemUnselected: '#607582',
    },
    dark: {
      background: '#0F1A22',
      backgroundSecondary: '#15222C',
      surface: '#1C2B38',
      surfaceElevated: '#243544',
      textPrimary: '#E8F0F5',
      textSecondary: '#94A8B8',
      accent: '#4DB8D0',
      textOnAccent: '#FFFFFF',
      accentMuted: '#3AA0B8',
      destructive: '#E05A52',
      border: '#2E4252',
      separator: '#283A48',
      tabBarBackground: '#15222C',
      tabBarItemSelected: '#4DB8D0',
      tabBarItemUnselected: '#6E8594',
    },
  },
  evergreen: {
    id: 'evergreen',
    name: 'Evergreen',
    light: {
      background: '#F0F3EE',
      backgroundSecondary: '#E4EAE2',
      surface: '#FFFFFF',
      surfaceElevated: '#F6F9F4',
      textPrimary: '#1C2820',
      textSecondary: '#546458',
      accent: '#3F6E4E',
      textOnAccent: '#FFFFFF',
      accentMuted: '#5F8F6C',
      destructive: '#B8453C',
      border: '#CFD8CC',
      separator: '#DAE3D8',
      tabBarBackground: '#F6F9F4',
      tabBarItemSelected: '#2F5A3C',
      tabBarItemUnselected: '#68756C',
    },
    dark: {
      background: '#141A16',
      backgroundSecondary: '#1C241E',
      surface: '#242E28',
      surfaceElevated: '#2C3830',
      textPrimary: '#ECF0ED',
      textSecondary: '#98A89C',
      accent: '#6AA078',
      textOnAccent: '#FFFFFF',
      accentMuted: '#588C68',
      destructive: '#E05A52',
      border: '#38483C',
      separator: '#324036',
      tabBarBackground: '#1C241E',
      tabBarItemSelected: '#6AA078',
      tabBarItemUnselected: '#78887C',
    },
  },
  lavender_dusk: {
    id: 'lavender_dusk',
    name: 'Lavender Dusk',
    light: {
      background: '#F3F0F7',
      backgroundSecondary: '#E9E4F0',
      surface: '#FFFFFF',
      surfaceElevated: '#F8F5FB',
      textPrimary: '#262032',
      textSecondary: '#645C72',
      accent: '#7A5C9E',
      textOnAccent: '#FFFFFF',
      accentMuted: '#9A82BA',
      destructive: '#B54045',
      border: '#DCD4E6',
      separator: '#E6DEED',
      tabBarBackground: '#F8F5FB',
      tabBarItemSelected: '#5C4282',
      tabBarItemUnselected: '#766D82',
    },
    dark: {
      background: '#16141C',
      backgroundSecondary: '#1E1C26',
      surface: '#282432',
      surfaceElevated: '#302C3A',
      textPrimary: '#F0ECF5',
      textSecondary: '#A8A0B4',
      accent: '#A888C8',
      textOnAccent: '#FFFFFF',
      accentMuted: '#8E72AE',
      destructive: '#E05A52',
      border: '#3C3848',
      separator: '#343040',
      tabBarBackground: '#1E1C26',
      tabBarItemSelected: '#A888C8',
      tabBarItemUnselected: '#887E96',
    },
  },
  paper_minimal: {
    id: 'paper_minimal',
    name: 'Paper Minimal',
    light: {
      background: '#FAFAF8',
      backgroundSecondary: '#F0F0EC',
      surface: '#FFFFFF',
      surfaceElevated: '#F6F6F2',
      textPrimary: '#1A1A18',
      textSecondary: '#5C5C58',
      accent: '#3A3A36',
      textOnAccent: '#FFFFFF',
      accentMuted: '#6A6A66',
      destructive: '#C0392B',
      border: '#DCDCD6',
      separator: '#E6E6E0',
      tabBarBackground: '#F6F6F2',
      tabBarItemSelected: '#1A1A18',
      tabBarItemUnselected: '#71716E',
    },
    dark: {
      background: '#121210',
      backgroundSecondary: '#1A1A18',
      surface: '#222220',
      surfaceElevated: '#2A2A28',
      textPrimary: '#F2F2F0',
      textSecondary: '#9A9A96',
      accent: '#C8C8C4',
      textOnAccent: '#FFFFFF',
      accentMuted: '#9A9A96',
      destructive: '#E05A52',
      border: '#383836',
      separator: '#323230',
      tabBarBackground: '#1A1A18',
      tabBarItemSelected: '#F2F2F0',
      tabBarItemUnselected: '#7A7A76',
    },
  },
};

export const DefaultPaletteId: PaletteId = 'classic_rose';
