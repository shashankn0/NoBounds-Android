import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
};

type Couple = {
  id: string;
};

type SessionContextValue = {
  isLoading: boolean;
  session: Session | null;
  profile: Profile | null;
  couple: Couple | null;
  refreshCouple: () => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);

  async function loadForSession(nextSession: Session | null) {
    if (!nextSession) {
      setProfile(null);
      setCouple(null);
      return;
    }

    const { data: profileRow } = await supabase.rpc('ensure_own_profile').single();
    setProfile((profileRow as Profile) ?? null);

    const { data: memberRow } = await supabase
      .from('couple_members')
      .select('couple_id')
      .eq('user_id', nextSession.user.id)
      .maybeSingle();
    setCouple(memberRow ? { id: memberRow.couple_id } : null);
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

  async function signOut() {
    await supabase.auth.signOut();
  }

  return (
    <SessionContext.Provider
      value={{ isLoading, session, profile, couple, refreshCouple, signOut }}>
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
