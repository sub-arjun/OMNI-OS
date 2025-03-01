import Debug from 'debug';
import { create } from 'zustand';
import supabase from 'vendors/supa';
import {
  AuthError,
  AuthResponse,
  Session,
  Subscription,
  User,
} from '@supabase/supabase-js';

const debug = Debug('OMNI-OS:stores:useAuthStore');

export interface IAuthStore {
  session: Session | null;
  user: User | null;
  load: () => Promise<AuthResponse>;
  setSession: (args: {
    accessToken: string;
    refreshToken: string;
  }) => Promise<AuthResponse>;
  signInWithEmailAndPassword: (
    email: string,
    password: string
  ) => Promise<AuthResponse>;
  signOut: () => Promise<{ error: AuthError | null }>;
  onAuthStateChange: (
    callback?: (event: any, session: any) => void
  ) => Subscription;
  saveInactiveUser: (user: User) => void;
}

const useAuthStore = create<IAuthStore>((set, get) => ({
  session: null,
  user: null,
  /**
   * 加载有下面几种情况
   * 1. 本地没有 session
   *  1.1 也没有 user 信息
   *  1.2 有 User信息， 这种情况比较特殊， 只有一种可能性，就是用户刚注册，还未通过 Email 确认激活。
   *      这种情况下，我们需要获取本地的 InactiveUser 作为 User信息
   *  2. 本地有 Session
   *    2.1 Session 有效，返回
   *    2.2 Session 过期，返回 null
   */
  load: async () => {
    let {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    let user = null;

    if (error) {
      debug('loadSession error', error);
      return {
        data: {
          session,
          user,
        },
        error,
      } as AuthResponse;
    }

    debug('loadSession', session);
    if (session) {
      if ((session.expires_at as number) >= Date.now()) {
        session = null;
      } else {
        user = session.user;
      }
    } else {
      const serialized = localStorage.getItem('inactive-user');
      if (serialized) {
        user = JSON.parse(serialized) as User;
      }
    }
    debug('Set session:', session);
    debug('Set user:', user);
    set({ session, user });
    return {
      data: {
        session,
        user,
      },
      error: null,
    } as AuthResponse;
  },

  setSession: async (args) => {
    const resp = await supabase.auth.setSession({
      access_token: args.accessToken,
      refresh_token: args.refreshToken,
    });
    debug('setSession data', resp.data);
    set({
      session: resp.data.session,
      user: resp.data.user,
    });
    return resp;
  },

  onAuthStateChange: (callback?: (event: any, session: any) => void) => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user?.id == get().user?.id) return;
      if (callback) callback(event, session);
      set({ session, user: session?.user });
      debug('onAuthStateChange', event, session);
    });
    return subscription;
  },
  signInWithEmailAndPassword: async (email: string, password: string) => {
    const resp = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    const { session, user } = resp.data;
    set({ session, user });
    return resp;
  },
  signOut: async () => {
    localStorage.removeItem('inactive-user');
    const { error } = await supabase.auth.signOut();
    if (error) {
      debug('signOut error', error);
    } else {
      set({ session: null, user: null });
    }
    return { error };
  },
  saveInactiveUser(user: User) {
    localStorage.setItem('inactive-user', JSON.stringify(user));
    set({ user });
  },
}));

export default useAuthStore;
