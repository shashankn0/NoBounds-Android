import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

// mirrors public.profiles
type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  time_zone: string | null;
  created_at: string;
};

// just the id — null means not paired yet
type Couple = {
  id: string;
};

// mirrors public.user_app_settings
type AppSettings = {
  palette_id: string;
  appearance_mode: 'system' | 'light' | 'dark';
};

type SessionContextValue = {
  isLoading: boolean;
  session: Session | null;
  profile: Profile | null;
  couple: Couple | null;
  appSettings: AppSettings | null;
  refreshCouple: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);

  // loads profile, couple, and settings for whichever session is currently active
  async function loadForSession(nextSession: Session | null) {
    if (!nextSession) {
      // signed out — clear everything
      setProfile(null);
      setCouple(null);
      setAppSettings(null);
      return;
    }

    // creates the profile/settings rows on first sign-in, otherwise just fetches them
    const { data: profileRow } = await supabase.rpc('ensure_own_profile').single();
    setProfile((profileRow as Profile) ?? null);

    const [{ data: memberRow }, { data: settingsRow }] = await Promise.all([
      supabase.from('couple_members').select('couple_id').eq('user_id', nextSession.user.id).maybeSingle(),
      supabase
        .from('user_app_settings')
        .select('palette_id, appearance_mode')
        .eq('user_id', nextSession.user.id)
        .maybeSingle(),
    ]);
    setCouple(memberRow ? { id: memberRow.couple_id } : null);
    setAppSettings((settingsRow as AppSettings | null) ?? null);
  }

  useEffect(() => {
    // restore whatever session is already on the device
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadForSession(data.session);
      setIsLoading(false);
    });

    // keep in sync with sign-in / sign-out / token refresh
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      loadForSession(nextSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  // call after pairing changes, so couple state updates without a full reload
  async function refreshCouple() {
    await loadForSession(session);
  }

  // call after saving profile edits
  async function refreshProfile() {
    if (!session) return;
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, time_zone, created_at')
      .eq('id', session.user.id)
      .single();
    setProfile((profileRow as Profile) ?? null);
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <SessionContext.Provider
      value={{ isLoading, session, profile, couple, appSettings, refreshCouple, refreshProfile, signOut }}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}
