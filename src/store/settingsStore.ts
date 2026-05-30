import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";
export type AcceptMode = "copy" | "move";
export type RejectMode = "none" | "move";
export type VizMode = 
  | "dual_waveform" 
  | "rms_meter" 
  | "aurora" 
  | "vu_meter" 
  | "lissajous" 
  | "wave";
export type CoverApplyMode = "off" | "onAccept" | "onFolderLoad";

interface SettingsState {
  theme: Theme;
  acceptMode: AcceptMode;
  rejectMode: RejectMode;
  rejectedFolder: string | null;
  targetFolder: string | null;
  seekStep: number;
  autoPlayNext: boolean;
  autoPlayAfterLoad: boolean;
  coverApplyMode: CoverApplyMode;
  saveBrokenToFile: boolean;
  vizEnabled: boolean;
  vizMode: VizMode;
  vizSensitivity: number;
  performanceMode: boolean;
  keys: {
    accept: string;
    reject: string;
    playPause: string;
    volumeUp: string;
    volumeDown: string;
    seekBack: string;
    seekForward: string;
    prevTrack: string;
    nextTrack: string;
  };

  set: <K extends keyof SettingsState>(key: K, value: SettingsState[K]) => void;
  setKeys: (keys: Partial<SettingsState["keys"]>) => void;
  clearFolders: () => void;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      theme: "dark",
      acceptMode: "copy",
      rejectMode: "none",
      rejectedFolder: null,
      targetFolder: null,
      seekStep: 10,
      autoPlayNext: true,
      autoPlayAfterLoad: true,
      coverApplyMode: "off",
      saveBrokenToFile: false,
      vizEnabled: true,
      vizMode: "dual_waveform",
      vizSensitivity: 1,
      performanceMode: false,
      keys: {
        accept: "ArrowRight",
        reject: "ArrowLeft",
        playPause: "Space",
        volumeUp: "ArrowUp",
        volumeDown: "ArrowDown",
        seekBack: "KeyA",
        seekForward: "KeyD",
        prevTrack: "KeyW",
        nextTrack: "KeyS",
      },

      set: (key, value) => set({ [key]: value }),
      setKeys: (keys) => set((state) => ({ keys: { ...state.keys, ...keys } })),
      clearFolders: () => set({ rejectedFolder: null, targetFolder: null }),
    }),
    {
      name: "sortify-settings",
      partialize: (state) => {
        const { rejectedFolder, targetFolder, ...rest } = state;
        return rest;
      },
    }
  )
);