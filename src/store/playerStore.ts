import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AudioFileEntry } from "@/types/electron";

export type TrackStatus = "pending" | "accepted" | "rejected" | "error" | "played" | "moved";

export interface Track extends AudioFileEntry {
  id: string;
  status: TrackStatus;
  url?: string;
  cover?: string;
}

interface PlayerState {
  tracks: Track[];
  brokenTracks: Track[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  sourceFolder: string | null;
  processedPaths: string[];

  setTracks: (tracks: Track[], sourceFolder: string | null) => void;
  setBrokenTracks: (tracks: Track[]) => void;
  clearBrokenTracks: () => void;
  addBrokenTrack: (track: { id: string; name: string; path: string }) => void;
  setStatus: (id: string, status: TrackStatus) => void;
  removeTrack: (id: string) => void;
  addProcessedPath: (path: string) => void;
  isPathProcessed: (path: string) => boolean;
  next: () => void;
  prev: () => void;
  setIndex: (i: number) => void;
  setIsPlaying: (b: boolean) => void;
  setTime: (t: number) => void;
  setDuration: (d: number) => void;
  setVolume: (v: number) => void;
  clearProcessed: () => void;
  skipToNextValid: () => void;
  reset: () => void;
  markCurrentAsPlayed: () => void;
  renameTrack: (id: string, newName: string) => Promise<boolean>;
  setTrackCover: (id: string, cover: string | undefined) => Promise<boolean>;
  // Сохранение сессии
  saveSession: () => void;
  hasSession: () => boolean;
  clearSession: () => void;
}

export const usePlayer = create<PlayerState>()(
  persist(
    (set, get) => ({
      tracks: [],
      brokenTracks: [],
      currentIndex: 0,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      volume: 0.85,
      sourceFolder: null,
      processedPaths: [],

      setTracks: (tracks, sourceFolder) => {
        const { isPathProcessed } = get();
        const filteredTracks = tracks.filter(track => !isPathProcessed(track.path));
        console.log(`📊 Total: ${tracks.length}, Already processed: ${tracks.length - filteredTracks.length}, New: ${filteredTracks.length}`);
        set({ tracks: filteredTracks, sourceFolder, currentIndex: 0 });
        return filteredTracks;
      },

      setBrokenTracks: (tracks) => set({ brokenTracks: tracks }),
      clearBrokenTracks: () => set({ brokenTracks: [] }),

      addBrokenTrack: (track) => set((s) => {
        const alreadyExists = s.brokenTracks.some(t => t.id === track.id);
        if (!alreadyExists) {
          const brokenTrack: Track = {
            id: track.id, name: track.name, path: track.path,
            size: 0, extension: track.path.split('.').pop()?.toLowerCase() || '', status: "error"
          };
          const newTracks = s.tracks.map((t) =>
            t.id === track.id ? { ...t, status: "error" as TrackStatus } : t
          );
          return { brokenTracks: [...s.brokenTracks, brokenTrack], tracks: newTracks };
        }
        return s;
      }),

      setStatus: (id, status) =>
        set((s) => {
          const track = s.tracks.find(t => t.id === id);
          if (track && status !== "pending" && status !== "error" && status !== "played") {
            if (!s.processedPaths.includes(track.path)) {
              s.processedPaths.push(track.path);
            }
          }
          return {
            tracks: s.tracks.map((t) => (t.id === id ? { ...t, status } : t)),
            processedPaths: s.processedPaths
          };
        }),

      removeTrack: (id) => set((s) => {
        const trackIndex = s.tracks.findIndex(t => t.id === id);
        const newTracks = s.tracks.filter(t => t.id !== id);
        let newIndex = s.currentIndex;
        if (trackIndex < s.currentIndex) newIndex = s.currentIndex - 1;
        else if (trackIndex === s.currentIndex) newIndex = s.currentIndex;
        if (newIndex >= newTracks.length) newIndex = newTracks.length - 1;
        if (newIndex < 0) newIndex = 0;
        return { tracks: newTracks, currentIndex: newIndex, processedPaths: s.processedPaths };
      }),

      addProcessedPath: (path) => set((s) => {
        if (!s.processedPaths.includes(path)) s.processedPaths.push(path);
        return { processedPaths: s.processedPaths };
      }),

      isPathProcessed: (path) => get().processedPaths.includes(path),

      next: () => {
        const { tracks, currentIndex, markCurrentAsPlayed } = get();
        if (tracks[currentIndex]?.status === "pending") markCurrentAsPlayed();
        let nextIndex = currentIndex + 1;
        while (nextIndex < tracks.length && (tracks[nextIndex].status === "error" || tracks[nextIndex].status === "moved")) nextIndex++;
        if (nextIndex < tracks.length) set({ currentIndex: nextIndex, currentTime: 0 });
        else set({ isPlaying: false });
      },

      prev: () => {
        const { tracks, currentIndex, markCurrentAsPlayed } = get();
        if (tracks[currentIndex]?.status === "pending") markCurrentAsPlayed();
        let prevIndex = currentIndex - 1;
        while (prevIndex >= 0 && (tracks[prevIndex].status === "error" || tracks[prevIndex].status === "moved")) prevIndex--;
        if (prevIndex >= 0) set({ currentIndex: prevIndex, currentTime: 0 });
      },

      setIndex: (i) => {
        const { tracks } = get();
        if (i >= 0 && i < tracks.length) {
          const status = tracks[i].status;
          if (status === "error" || status === "moved") return;
          set({ currentIndex: i, currentTime: 0 });
        }
      },

      skipToNextValid: () => {
        const { tracks, currentIndex } = get();
        let nextIndex = currentIndex + 1;
        while (nextIndex < tracks.length && (tracks[nextIndex].status === "error" || tracks[nextIndex].status === "moved")) nextIndex++;
        if (nextIndex < tracks.length) set({ currentIndex: nextIndex, currentTime: 0 });
      },

      markCurrentAsPlayed: () => {
        const { tracks, currentIndex } = get();
        const currentTrack = tracks[currentIndex];
        if (currentTrack?.status === "pending") {
          set((s) => ({
            tracks: s.tracks.map((t, i) => i === currentIndex ? { ...t, status: "played" } : t)
          }));
        }
      },

      renameTrack: async (id, newName) => {
        const track = get().tracks.find(t => t.id === id);
        if (!track) return false;
        const api = window.electronAPI;
        if (!api) return false;
        try {
          const renameResult = await api.renameFile(track.path, newName);
          if (renameResult.ok) {
            const newPath = renameResult.newPath;
            if (typeof api.updateTitle === 'function') {
              try { await api.updateTitle(newPath, newName); } catch {}
            }
            set((s) => ({
              tracks: s.tracks.map((t) => t.id === id ? { ...t, name: newName, path: newPath } : t),
            }));
            return true;
          }
          return false;
        } catch { return false; }
      },

      setTrackCover: async (id, coverBase64) => {
        const track = get().tracks.find(t => t.id === id);
        if (!track) return false;
        const api = window.electronAPI;
        if (!api) return false;
        try {
          const result = await api.updateCover(track.path, coverBase64 || '');
          if (result.ok) {
            set((s) => ({
              tracks: s.tracks.map((t) => t.id === id ? { ...t, cover: coverBase64 } : t),
            }));
            return true;
          }
          return false;
        } catch { return false; }
      },

      // ✅ Сохранение сессии — запоминает текущую папку + индекс + статусы
      saveSession: () => {
        const { tracks, currentIndex, sourceFolder, processedPaths } = get();
        if (!sourceFolder || tracks.length === 0) return;
        const sessionData = {
          sourceFolder,
          currentIndex,
          processedPaths,
          trackStatuses: tracks.map(t => ({ id: t.id, path: t.path, status: t.status })),
          savedAt: Date.now(),
        };
        localStorage.setItem('rhythm-sort-session', JSON.stringify(sessionData));
        console.log('💾 Session saved at index', currentIndex);
      },

      hasSession: () => {
        const raw = localStorage.getItem('rhythm-sort-session');
        if (!raw) return false;
        try {
          const s = JSON.parse(raw);
          return !!s.sourceFolder && !!s.trackStatuses?.length;
        } catch { return false; }
      },

      clearSession: () => {
        localStorage.removeItem('rhythm-sort-session');
        console.log('🗑️ Session cleared');
      },

      setIsPlaying: (b) => set({ isPlaying: b }),
      setTime: (t) => set({ currentTime: t }),
      setDuration: (d) => set({ duration: d }),
      setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),

      clearProcessed: () => set({ processedPaths: [] }),

      reset: () => {
        get().clearSession();
        set({ tracks: [], currentIndex: 0, sourceFolder: null, processedPaths: [], brokenTracks: [] });
      },
    }),
    {
      name: 'rhythm-sort-player',
      // Сохраняем только то что нужно между сессиями
      partialize: (state) => ({
        volume: state.volume,
        processedPaths: state.processedPaths,
      }),
    }
  )
);
