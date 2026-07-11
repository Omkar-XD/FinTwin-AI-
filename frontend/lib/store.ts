import { create } from 'zustand';
import type { User, UploadedFile } from './types';
import { getSupabaseBrowserClient } from './supabase';

export interface AuthStore {
  user: User | null;
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  initialize: () => Promise<void>;
}

export interface AppStore {
  uploadedFiles: UploadedFile[];
  processingProgress: number;
  isProcessing: boolean;
  addFile: (file: UploadedFile) => void;
  removeFile: (fileId: string) => void;
  setProcessingProgress: (progress: number) => void;
  setIsProcessing: (isProcessing: boolean) => void;
  clearFiles: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isLoggedIn: false,
  isLoading: false,
  login: async (email: string, password: string) => {
    set({ isLoading: true });
    const { data, error } = await getSupabaseBrowserClient().auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data.user) {
      set({ isLoading: false });
      throw error ?? new Error('Unable to sign in');
    }
    set({
      user: {
        id: data.user.id,
        email: data.user.email ?? email,
        name: data.user.user_metadata?.full_name ?? email.split('@')[0],
      },
      isLoggedIn: true,
      isLoading: false,
    });
  },
  logout: async () => {
    await getSupabaseBrowserClient().auth.signOut();
    set({ user: null, isLoggedIn: false });
  },
  initialize: async () => {
    set({ isLoading: true });
    try {
      const {
        data: { session },
      } = await getSupabaseBrowserClient().auth.getSession();
      const sessionUser = session?.user;
      set({
        user: sessionUser
          ? {
              id: sessionUser.id,
              email: sessionUser.email ?? '',
              name:
                sessionUser.user_metadata?.full_name ??
                sessionUser.email?.split('@')[0] ??
                'User',
            }
          : null,
        isLoggedIn: Boolean(sessionUser),
        isLoading: false,
      });
    } catch {
      set({ user: null, isLoggedIn: false, isLoading: false });
    }
  },
}));

// App state store
export const useAppStore = create<AppStore>((set) => ({
  uploadedFiles: [],
  processingProgress: 0,
  isProcessing: false,
  addFile: (file) =>
    set((state) => ({
      uploadedFiles: [...state.uploadedFiles, file],
    })),
  removeFile: (fileId) =>
    set((state) => ({
      uploadedFiles: state.uploadedFiles.filter((f) => f.id !== fileId),
    })),
  setProcessingProgress: (progress) => set({ processingProgress: progress }),
  setIsProcessing: (isProcessing) => set({ isProcessing }),
  clearFiles: () =>
    set({
      uploadedFiles: [],
      processingProgress: 0,
      isProcessing: false,
    }),
}));
