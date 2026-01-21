import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import type { AppRole } from '@/lib/constants';

const profileSchema = z.object({
  id: z.string(),
  factory_id: z.string().nullable(),
  full_name: z.string(),
  email: z.string(),
  phone: z.string().nullable(),
  avatar_url: z.string().nullable(),
  is_active: z.boolean(),
  department: z.string().nullable(),
  invitation_status: z.string().nullable().optional(),
});

const userRoleSchema = z.object({
  role: z.enum(['worker', 'admin', 'owner', 'storage', 'cutting']),
  factory_id: z.string().nullable(),
});

const factorySchema = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  subscription_tier: z.string(),
  subscription_status: z.string().nullable(),
  trial_end_date: z.string().nullable(),
  cutoff_time: z.string(),
  morning_target_cutoff: z.string().nullable(),
  evening_actual_cutoff: z.string().nullable(),
  timezone: z.string(),
  logo_url: z.string().nullable(),
  max_lines: z.number().nullable(),
  low_stock_threshold: z.number(),
});

type Profile = z.infer<typeof profileSchema>;
type UserRole = z.infer<typeof userRoleSchema>;
type Factory = z.infer<typeof factorySchema>;

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  roles: UserRole[];
  factory: Factory | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  hasRole: (role: AppRole) => boolean;
  isAdminOrHigher: () => boolean;
  isSuperAdmin: () => boolean;
  isStorageUser: () => boolean;
  isCuttingUser: () => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<UserRole[]>([]);
  const [factory, setFactory] = useState<Factory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Defer data fetching to avoid deadlock
        if (session?.user) {
          setTimeout(() => {
            fetchUserData(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setRoles([]);
          setFactory(null);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchUserData(session.user.id);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  async function fetchUserData(userId: string) {
    try {
      // Fetch profile
      const { data: profileData } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileData) {
        if (profileData.invitation_status === 'pending') {
          await supabase
            .from('profiles')
            .update({ invitation_status: 'active' })
            .eq('id', userId);
          profileData.invitation_status = 'active';
        }

        const profileResult = profileSchema.safeParse(profileData);
        if (!profileResult.success) {
          console.error('Invalid profile data:', profileResult.error);
          return;
        }
        setProfile(profileResult.data);

        const { data: rolesData } = await supabase
          .from('user_roles')
          .select('role, factory_id')
          .eq('user_id', userId);

        if (rolesData) {
          const rolesResult = z.array(userRoleSchema).safeParse(rolesData);
          if (rolesResult.success) {
            const filtered = rolesResult.data.filter((r) => {
              if (profileResult.data.factory_id) return r.factory_id === profileResult.data.factory_id;
              return r.factory_id === null;
            });
            setRoles(filtered);
          } else {
            console.error('Invalid roles data:', rolesResult.error);
          }
        }

        if (profileResult.data.factory_id) {
          const { data: factoryData } = await supabase
            .from('factory_accounts')
            .select('*')
            .eq('id', profileResult.data.factory_id)
            .maybeSingle();

          if (factoryData) {
            const factoryResult = factorySchema.safeParse(factoryData);
            if (factoryResult.success) {
              setFactory(factoryResult.data);
            } else {
              console.error('Invalid factory data:', factoryResult.error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { error };
  }

  async function signUp(email: string, password: string, fullName: string) {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: redirectUrl,
        data: {
          full_name: fullName,
        },
      },
    });
    return { error };
  }

  async function signOut() {
    // Clear local state first to ensure UI updates immediately
    setUser(null);
    setSession(null);
    setProfile(null);
    setRoles([]);
    setFactory(null);
    
    // Then attempt to sign out from Supabase (may fail if session already expired)
    try {
      await supabase.auth.signOut();
    } catch (error) {
      // Ignore sign out errors - session may already be invalid
      console.log('Sign out completed (session may have already expired)');
    }
  }

  function hasRole(role: AppRole): boolean {
    return roles.some(r => r.role === role);
  }

  function isAdminOrHigher(): boolean {
    return roles.some(r => ['admin', 'owner'].includes(r.role));
  }

  // Keep for backwards compatibility - admin now has all privileges
  function isSuperAdmin(): boolean {
    return roles.some(r => r.role === 'admin');
  }

  function isStorageUser(): boolean {
    return roles.some(r => r.role === 'storage');
  }

  function isCuttingUser(): boolean {
    return roles.some(r => r.role === 'cutting');
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        roles,
        factory,
        loading,
        signIn,
        signUp,
        signOut,
        hasRole,
        isAdminOrHigher,
        isSuperAdmin,
        isStorageUser,
        isCuttingUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
