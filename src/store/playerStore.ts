import { create } from "zustand";
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
}

export const usePlayer = create<PlayerState>()((set, get) => ({
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
      console.log(`🔴 Adding to broken tracks: ${track.name}`);
      
      const brokenTrack: Track = {
        id: track.id,
        name: track.name,
        path: track.path,
        size: 0,
        extension: track.path.split('.').pop()?.toLowerCase() || '',
        status: "error"
      };
      
      const newBrokenTracks = [...s.brokenTracks, brokenTrack];

      // ✅ FIX 3: синхронизируем статус "error" в основном массиве tracks
      const newTracks = s.tracks.map((t) =>
        t.id === track.id ? { ...t, status: "error" as TrackStatus } : t
      );
      
      return { brokenTracks: newBrokenTracks, tracks: newTracks };
    } else {
      console.log(`⚠️ Track already in broken list: ${track.name}`);
    }
    return s;
  }),

  setStatus: (id, status) =>
    set((s) => {
      const track = s.tracks.find(t => t.id === id);
      if (track && status !== "pending" && status !== "error" && status !== "played") {
        if (!s.processedPaths.includes(track.path)) {
          console.log(`✅ Adding to processed: ${track.path}`);
          s.processedPaths.push(track.path);
        }
      }

      const newTracks = s.tracks.map((t) => (t.id === id ? { ...t, status } : t));

      return {
        tracks: newTracks,
        processedPaths: s.processedPaths
      };
    }),

  removeTrack: (id) => set((s) => {
    const trackIndex = s.tracks.findIndex(t => t.id === id);
    const newTracks = s.tracks.filter(t => t.id !== id);

    let newIndex = s.currentIndex;
    if (trackIndex < s.currentIndex) {
      newIndex = s.currentIndex - 1;
    } else if (trackIndex === s.currentIndex) {
      newIndex = s.currentIndex;
    }

    if (newIndex >= newTracks.length) {
      newIndex = newTracks.length - 1;
    }
    if (newIndex < 0) {
      newIndex = 0;
    }

    console.log(`🗑️ Removed track at index ${trackIndex}, new index: ${newIndex}, remaining: ${newTracks.length}`);

    return {
      tracks: newTracks,
      currentIndex: newIndex,
      processedPaths: s.processedPaths
    };
  }),

  addProcessedPath: (path) => set((s) => {
    if (!s.processedPaths.includes(path)) {
      console.log(`➕ Manually adding processed path: ${path}`);
      s.processedPaths.push(path);
    }
    return { processedPaths: s.processedPaths };
  }),

  isPathProcessed: (path) => {
    const { processedPaths } = get();
    return processedPaths.includes(path);
  },

  next: () => {
    const { tracks, currentIndex, markCurrentAsPlayed } = get();
    if (tracks[currentIndex] && tracks[currentIndex].status === "pending") {
      markCurrentAsPlayed();
    }

    let nextIndex = currentIndex + 1;
    while (nextIndex < tracks.length && (tracks[nextIndex].status === "error" || tracks[nextIndex].status === "moved")) {
      nextIndex++;
    }
    if (nextIndex < tracks.length) {
      set({ currentIndex: nextIndex, currentTime: 0 });
      console.log(`⏭️ Next track: ${currentIndex + 1} -> ${nextIndex + 1}`);
    } else {
      console.log("🏁 End of queue reached");
      set({ isPlaying: false });
    }
  },

  prev: () => {
    const { tracks, currentIndex, markCurrentAsPlayed } = get();
    if (tracks[currentIndex] && tracks[currentIndex].status === "pending") {
      markCurrentAsPlayed();
    }

    let prevIndex = currentIndex - 1;
    while (prevIndex >= 0 && (tracks[prevIndex].status === "error" || tracks[prevIndex].status === "moved")) {
      prevIndex--;
    }
    if (prevIndex >= 0) {
      set({ currentIndex: prevIndex, currentTime: 0 });
      console.log(`⏮️ Previous track: ${currentIndex + 1} -> ${prevIndex + 1}`);
    }
  },

  // ✅ FIX: setIndex блокирует "error" и "moved" (файл удалён с диска)
  // "accepted" (Copy режим) — разрешаем, файл остался на месте
  setIndex: (i) => {
    const { tracks } = get();
    if (i >= 0 && i < tracks.length) {
      const status = tracks[i].status;
      if (status === "error") {
        console.log(`⛔ Skipping broken track at index ${i}`);
        return;
      }
      if (status === "moved") {
        console.log(`⛔ Skipping moved track at index ${i} — file no longer exists`);
        return;
      }
      console.log(`🎯 Selected track at index ${i}`);
      set({ currentIndex: i, currentTime: 0 });
    }
  },

  skipToNextValid: () => {
    const { tracks, currentIndex } = get();
    let nextIndex = currentIndex + 1;
    while (nextIndex < tracks.length && (tracks[nextIndex].status === "error" || tracks[nextIndex].status === "moved")) {
      nextIndex++;
    }
    if (nextIndex < tracks.length) {
      set({ currentIndex: nextIndex, currentTime: 0 });
    }
  },

  markCurrentAsPlayed: () => {
    const { tracks, currentIndex } = get();
    const currentTrack = tracks[currentIndex];
    if (currentTrack && currentTrack.status === "pending") {
      console.log(`🎧 Marking as played: ${currentTrack.name}`);
      set((s) => ({
        tracks: s.tracks.map((t, i) =>
          i === currentIndex ? { ...t, status: "played" } : t
        )
      }));
    }
  },

  // ✅ FIX 1: обёрнуто в try/catch, убран вызов updateTitle (который может отсутствовать)
  renameTrack: async (id, newName) => {
    const track = get().tracks.find(t => t.id === id);
    if (!track) return false;

    const api = window.electronAPI;
    if (!api) return false;

    try {
      const renameResult = await api.renameFile(track.path, newName);
      if (renameResult.ok) {
        const newPath = renameResult.newPath;

        // updateTitle — опциональный вызов, не крашим если его нет
        if (typeof api.updateTitle === 'function') {
          try {
            await api.updateTitle(newPath, newName);
          } catch (titleErr) {
            console.warn('updateTitle failed (non-critical):', titleErr);
          }
        }

        set((s) => ({
          tracks: s.tracks.map((t) =>
            t.id === id ? { ...t, name: newName, path: newPath } : t
          ),
        }));
        return true;
      } else {
        console.error('Failed to rename file:', renameResult.error);
        return false;
      }
    } catch (err) {
      console.error('renameTrack exception:', err);
      return false;
    }
  },

  setTrackCover: async (id, coverBase64) => {
    const track = get().tracks.find(t => t.id === id);
    if (track) {
      const api = window.electronAPI;
      if (api) {
        try {
          const result = await api.updateCover(track.path, coverBase64 || '');
          if (result.ok) {
            set((s) => ({
              tracks: s.tracks.map((t) =>
                t.id === id ? { ...t, cover: coverBase64 } : t
              ),
            }));
            return true;
          } else {
            console.error('Failed to update cover:', result.error);
            return false;
          }
        } catch (err) {
          console.error('setTrackCover exception:', err);
          return false;
        }
      }
    }
    return false;
  },

  setIsPlaying: (b) => set({ isPlaying: b }),
  setTime: (t) => set({ currentTime: t }),
  setDuration: (d) => set({ duration: d }),
  setVolume: (v) => set({ volume: Math.max(0, Math.min(1, v)) }),

  clearProcessed: () => {
    console.log("🗑️ Clearing processed history");
    set({ processedPaths: [] });
  },

  reset: () => {
    console.log("🔄 Resetting player state");
    set({ tracks: [], currentIndex: 0, sourceFolder: null, processedPaths: [], brokenTracks: [] });
  },
}));