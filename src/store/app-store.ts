"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CameraParams } from "@/lib/camera";
import { DEFAULT_CAMERA } from "@/lib/camera";

export interface GeneratedItem {
  id: string;
  image: string; // data URL of generated image
  params: CameraParams;
  prompt: string;
  createdAt: number;
}

interface AppState {
  // Input
  sourceImage: string | null;
  sourceName: string;

  // Camera
  camera: CameraParams;

  // Result
  isGenerating: boolean;
  lastResult: GeneratedItem | null;
  error: string | null;

  // History
  history: GeneratedItem[];

  // Actions
  setSourceImage: (image: string | null, name?: string) => void;
  setCamera: (patch: Partial<CameraParams>) => void;
  resetCamera: () => void;
  setGenerating: (v: boolean) => void;
  setResult: (item: GeneratedItem | null) => void;
  setError: (err: string | null) => void;
  pushHistory: (item: GeneratedItem) => void;
  removeHistory: (id: string) => void;
  removeManyHistory: (ids: string[]) => void;
  clearHistory: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      sourceImage: null,
      sourceName: "",
      camera: { ...DEFAULT_CAMERA },
      isGenerating: false,
      lastResult: null,
      error: null,
      history: [],

      setSourceImage: (image, name = "") =>
        set({ sourceImage: image, sourceName: name, error: null }),

      setCamera: (patch) =>
        set((s) => ({ camera: { ...s.camera, ...patch } })),

      resetCamera: () => set({ camera: { ...DEFAULT_CAMERA } }),

      setGenerating: (v) => set({ isGenerating: v, error: null }),
      setResult: (item) => set({ lastResult: item }),
      setError: (err) => set({ error: err }),

      pushHistory: (item) =>
        set((s) => ({ history: [item, ...s.history].slice(0, 60) })),

      removeHistory: (id) =>
        set((s) => ({ history: s.history.filter((h) => h.id !== id) })),

      removeManyHistory: (ids) =>
        set((s) => {
          const idSet = new Set(ids);
          const newHistory = s.history.filter((h) => !idSet.has(h.id));
          const newLastResult =
            s.lastResult && idSet.has(s.lastResult.id)
              ? null
              : s.lastResult;
          return { history: newHistory, lastResult: newLastResult };
        }),

      clearHistory: () => set({ history: [], lastResult: null }),
    }),
    {
      name: "multi-angle-3d-camera",
      // Only persist history + last result + source image. Camera params
      // are reset to defaults each session for predictable UX.
      partialize: (s) => ({
        history: s.history,
        lastResult: s.lastResult,
        sourceImage: s.sourceImage,
        sourceName: s.sourceName,
      }),
    }
  )
);
