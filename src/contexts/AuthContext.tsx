import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { withTimeout } from "@/lib/timeout";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  /** True only if the signed-in user has a row in `admins`. */
  isAdmin: boolean;
  /** True while the initial session check (and admin lookup) is running. */
  loading: boolean;
  /** Set if init failed (timeout, network error, etc). UI can offer recovery. */
  initError: string | null;
  signInWithEmail: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
  /**
   * Last-resort recovery: wipes Supabase's localStorage entries and reloads.
   * Useful when a stale session has put the client into a hung state.
   */
  resetAuthState: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

/**
 * Auth state, exposed via useAuth().
 *
 * Lifecycle:
 *   - On mount: read existing session from Supabase (handles magic-link
 *     redirects automatically thanks to detectSessionInUrl in supabase.ts).
 *   - Subscribe to onAuthStateChange so login/logout/refresh all flow
 *     through here.
 *   - Whenever the session changes, re-check admin status via the
 *     SECURITY DEFINER `is_admin()` RPC.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [initError, setInitError] = useState<string | null>(null);

  const checkAdmin = useCallback(async (s: Session | null) => {
    if (!s) {
      setIsAdmin(false);
      return;
    }
    const { data, error } = await withTimeout(
      supabase.rpc("is_admin"),
      6000,
      "supabase.rpc('is_admin')",
    );
    if (error) {
      console.warn("is_admin() RPC failed:", error.message);
      setIsAdmin(false);
    } else {
      setIsAdmin(data === true);
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // Wrap init in try/finally so a hung or thrown promise can never leave
    // `loading` stuck at true. The timeout guards against a Supabase client
    // that's deadlocked on a stale session in localStorage — without it, the
    // whole app would freeze on load.
    (async () => {
      try {
        const {
          data: { session: initialSession },
        } = await withTimeout(
          supabase.auth.getSession(),
          6000,
          "supabase.auth.getSession",
        );
        if (!mounted) return;
        setSession(initialSession);
        await checkAdmin(initialSession);
      } catch (err) {
        console.error("[auth] init failed:", err);
        if (mounted) {
          setInitError(err instanceof Error ? err.message : String(err));
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      try {
        await checkAdmin(newSession);
      } catch (err) {
        console.error("[auth] checkAdmin failed:", err);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [checkAdmin]);

  async function signInWithEmail(email: string) {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        // Honor the Vite base path so the redirect lands at /admin in dev
        // and at /dawushiye-dashboard/admin in prod (under GH Pages project URL).
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}admin`,
      },
    });
    if (error) throw error;
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  /**
   * Wipe Supabase localStorage entries and reload. Use when the client gets
   * stuck on a stale session (symptom: dashboard / admin pages hang on
   * "loading…" with no Supabase requests firing in DevTools Network tab).
   */
  function resetAuthState() {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith("sb-") || key.startsWith("supabase")) {
        localStorage.removeItem(key);
      }
    }
    window.location.reload();
  }

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        isAdmin,
        loading,
        initError,
        signInWithEmail,
        signOut,
        resetAuthState,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
