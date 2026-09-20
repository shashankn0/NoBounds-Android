import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

import { loadAvatarSource, saveAvatarSource, type AvatarSource } from '@/lib/avatar-preference';
import { unregisterPush } from '@/lib/push';
import { getSignedUrl } from '@/lib/storage';
import { supabase } from '@/lib/supabase';

// mirrors public.profiles
type Profile = {
  id: string;
  display_name: string;
  avatar_url: string | null;
  time_zone: string | null;
  created_at: string;
};

// null means not paired yet. partnerName is null while paired but the partner hasn't set one.
// partnerAvatarUrl is a bare avatars-bucket storage path (like profiles.avatar_url), not a real url.
type Couple = {
  id: string;
  partnerId: string | null;
  partnerName: string | null;
  partnerAvatarUrl: string | null;
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
  // which of the two partners' photos represents "you" around the app — see avatar-preference.ts
  avatarSource: AvatarSource;
  setAvatarSource: (source: AvatarSource) => Promise<void>;
  myAvatarUrl: string | null;
  partnerAvatarUrl: string | null;
  featuredAvatarUrl: string | null;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [couple, setCouple] = useState<Couple | null>(null);
  const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
  const [avatarSource, setAvatarSourceState] = useState<AvatarSource>('mine');
  const [myAvatarUrl, setMyAvatarUrl] = useState<string | null>(null);
  const [partnerAvatarUrl, setPartnerAvatarUrl] = useState<string | null>(null);

  // loads profile, couple, and settings for whichever session is currently active
  async function loadForSession(nextSession: Session | null) {
    if (!nextSession) {
      // signed out — clear everything
      setProfile(null);
      setCouple(null);
      setAppSettings(null);
      return;
    }

    // real ensure_own_profile() returns void (the profile row is normally already created by
    // the handle_new_user trigger on signup) — this is just a safety-net repair call, so the
    // actual row still needs a separate fetch afterward
    await supabase.rpc('ensure_own_profile');
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('id, display_name, avatar_url, time_zone, created_at')
      .eq('id', nextSession.user.id)
      .maybeSingle();
    setProfile((profileRow as Profile) ?? null);

    const [{ data: memberRow }, { data: settingsRow }] = await Promise.all([
      supabase.from('couple_members').select('couple_id').eq('user_id', nextSession.user.id).maybeSingle(),
      supabase
        .from('user_app_settings')
        .select('palette_id, appearance_mode')
        .eq('user_id', nextSession.user.id)
        .maybeSingle(),
    ]);
    setAppSettings((settingsRow as AppSettings | null) ?? null);

    if (!memberRow) {
      setCouple(null);
      return;
    }

    // the couple only ever has 2 members — find the row that isn't me, then look up their name
    const { data: partnerMemberRow } = await supabase
      .from('couple_members')
      .select('user_id')
      .eq('couple_id', memberRow.couple_id)
      .neq('user_id', nextSession.user.id)
      .maybeSingle();
    let partnerName: string | null = null;
    let partnerAvatarUrl: string | null = null;
    if (partnerMemberRow) {
      const { data: partnerProfileRow } = await supabase
        .from('profiles')
        .select('display_name, avatar_url')
        .eq('id', partnerMemberRow.user_id)
        .maybeSingle();
      const partnerProfile = partnerProfileRow as { display_name: string | null; avatar_url: string | null } | null;
      partnerName = partnerProfile?.display_name ?? null;
      partnerAvatarUrl = partnerProfile?.avatar_url ?? null;
    }
    setCouple({ id: memberRow.couple_id, partnerId: partnerMemberRow?.user_id ?? null, partnerName, partnerAvatarUrl });
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

  // restore the on-device avatar-source preference once at launch (mirrors ios reading
  // UserDefaults on ProfileViewModel.load())
  useEffect(() => {
    loadAvatarSource().then(setAvatarSourceState);
  }, []);

  // if the couple unpairs while "partner" was selected, force back to "mine" — same as ios
  useEffect(() => {
    if (!couple && avatarSource !== 'mine') {
      setAvatarSourceState('mine');
      saveAvatarSource('mine');
    }
  }, [couple, avatarSource]);

  useEffect(() => {
    if (!profile?.avatar_url) {
      setMyAvatarUrl(null);
      return;
    }
    getSignedUrl('avatars', profile.avatar_url).then(setMyAvatarUrl);
  }, [profile?.avatar_url]);

  useEffect(() => {
    if (!couple?.partnerAvatarUrl) {
      setPartnerAvatarUrl(null);
      return;
    }
    getSignedUrl('avatars', couple.partnerAvatarUrl).then(setPartnerAvatarUrl);
  }, [couple?.partnerAvatarUrl]);

  // saves immediately, no debounce/confirmation — matches ios's setAvatarSource
  async function setAvatarSource(source: AvatarSource) {
    setAvatarSourceState(source);
    await saveAvatarSource(source);
  }

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
    if (session) await unregisterPush(session.user.id);
    await supabase.auth.signOut();
  }

  const featuredAvatarUrl = avatarSource === 'partner' ? partnerAvatarUrl : myAvatarUrl;

  return (
    <SessionContext.Provider
      value={{
        isLoading,
        session,
        profile,
        couple,
        appSettings,
        refreshCouple,
        refreshProfile,
        signOut,
        avatarSource,
        setAvatarSource,
        myAvatarUrl,
        partnerAvatarUrl,
        featuredAvatarUrl,
      }}>
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
