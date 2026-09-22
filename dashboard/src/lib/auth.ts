import { supabase, hasSupabase } from './supabase';
import type { AppUser } from './types';

const LOCAL_KEY = 'traceops.localuser.v1';

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function readLocalUser(): AppUser | null {
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.email === 'string') {
      return { id: parsed.id || uid(), email: parsed.email, local: true };
    }
    return null;
  } catch {
    return null;
  }
}

export function writeLocalUser(email: string): AppUser {
  const user: AppUser = { id: uid(), email, local: true };
  try {
    localStorage.setItem(LOCAL_KEY, JSON.stringify(user));
  } catch {
    /* ignore */
  }
  return user;
}

export function clearLocalUser(): void {
  try {
    localStorage.removeItem(LOCAL_KEY);
  } catch {
    /* ignore */
  }
}

export async function getCurrentUser(): Promise<AppUser | null> {
  if (hasSupabase && supabase) {
    const { data } = await supabase.auth.getUser();
    if (data?.user?.email) {
      return {
        id: data.user.id,
        email: data.user.email,
        local: false,
      };
    }
  }
  return readLocalUser();
}

export async function signUp(
  email: string,
  password: string,
): Promise<{ user: AppUser | null; error: string | null; needsConfirm: boolean }> {
  if (hasSupabase && supabase) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { user: null, error: error.message, needsConfirm: false };
    if (data.user && !data.session) {
      return {
        user: { id: data.user.id, email, local: false },
        error: null,
        needsConfirm: true,
      };
    }
    if (data.user) {
      return {
        user: { id: data.user.id, email, local: false },
        error: null,
        needsConfirm: false,
      };
    }
  }
  return { user: writeLocalUser(email), error: null, needsConfirm: false };
}

export async function signIn(
  email: string,
  password: string,
): Promise<{ user: AppUser | null; error: string | null }> {
  if (hasSupabase && supabase) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) return { user: null, error: error.message };
    if (data.user) {
      return {
        user: { id: data.user.id, email: data.user.email || email, local: false },
        error: null,
      };
    }
  }
  return { user: writeLocalUser(email), error: null };
}

export async function signOut(): Promise<void> {
  if (hasSupabase && supabase) {
    await supabase.auth.signOut();
  }
  clearLocalUser();
}
