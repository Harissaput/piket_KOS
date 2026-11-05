'use client';

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { User } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/client';
import { Profile, Member, Role, ProfileStatus } from '@/types/database';

interface AuthContextType {
  user: User | null;
  profile: Profile | null;
  member: Member | null;
  role: Role | null;
  status: ProfileStatus | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  member: null,
  role: null,
  status: null,
  isLoading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [member, setMember] = useState<Member | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const supabase = createClient();

  const loadUserProfile = useCallback(async (currentUser: User | null) => {
    if (!currentUser) {
      setProfile(null);
      setMember(null);
      setIsLoading(false);
      return;
    }

    try {
      const { data: profileData, error: profileErr } = await supabase
        .from('profiles')
        .select('*, member:members(*)')
        .eq('id', currentUser.id)
        .maybeSingle();

      if (profileErr) {
        console.warn('[AuthContext] Error loading profile:', profileErr.message);
      }

      if (profileData) {
        setProfile(profileData as Profile);
        setMember((profileData.member as Member) || null);
      } else {
        setProfile(null);
        setMember(null);
      }
    } catch (err) {
      console.warn('[AuthContext] Exception loading profile:', err);
    } finally {
      setIsLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    async function initSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          const currentUser = session?.user ?? null;
          setUser(currentUser);
          await loadUserProfile(currentUser);
        }
      } catch (err) {
        console.warn('[AuthContext] Session init error:', err);
        if (mounted) setIsLoading(false);
      }
    }

    initSession();

    // Listen to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      await loadUserProfile(currentUser);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [loadUserProfile, supabase]);

  // Realtime subscription on profiles for current user (instant approval detection!)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel(`profile-user-${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${user.id}`,
        },
        async () => {
          await loadUserProfile(user);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadUserProfile, supabase]);

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
      setUser(null);
      setProfile(null);
      setMember(null);
      window.location.href = '/login';
    } catch (err) {
      console.error('[AuthContext] Sign out error:', err);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await loadUserProfile(user);
    }
  };

  const role = profile?.role ?? null;
  const status = profile?.status ?? null;

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        member,
        role,
        status,
        isLoading,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
