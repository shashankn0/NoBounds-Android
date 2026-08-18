import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  time_zone: string | null;
  created_at: string;
};

type Couple = {
  id: string;
};

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

  async function loadForSession(nextSession: Session | null) {
    if (!nextSession) {
      setProfile(null);
      setCouple(null);
      setAppSettings(null);
      return;
    }

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
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadForSession(data.session);
      setIsLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      loadForSession(nextSession);
    });

    return () => subscription.subscription.unsubscribe();
  }, []);

  async function refreshCouple() {
    await loadForSession(session);
  }

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
