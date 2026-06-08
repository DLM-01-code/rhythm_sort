import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Theme = "light" | "dark";
export type AcceptMode = "copy" | "move";
export type RejectMode = "none" | "move";
export type VizMode = 
  | "dual_waveform" | "rms_meter" | "aurora" | "vu_meter" | "lissajous" | "wave"
  | "particle_flow" | "dna_helix" | "ink_drop" | "city_lights"
  | "neon_ring" | "mirror_bars" | "plasma" | "oscilloscope";
export type CoverApplyMode = "off" | "onAccept" | "onFolderLoad";
export type BpmAnalyzeMode = "off" | "onAccept" | "both";

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
  // ✅ Новые настройки
  showTagsPanel: boolean;          // показывать панель тегов под плеером
  continueSession: boolean;        // спрашивать о продолжении сессии
  bpmAnalyzeMode: BpmAnalyzeMode; // когда анализировать BPM
  analyzeKey: boolean;             // анализировать тональность
  analyzeBpm: boolean;             // анализировать BPM
  renameTemplate: string;          // шаблон пакетного переименования
  brokenStopMode: "stop" | "one";   // при битых: остановить или пропускать по одному
  maxBrokenBeforeStop: number;       // сколько битых подряд до остановки
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
      showTagsPanel: false,
      continueSession: true,
      bpmAnalyzeMode: "off",
      analyzeKey: false,
      analyzeBpm: false,
      renameTemplate: "{BPM} - {Key} - {Artist} - {Title}",
      brokenStopMode: "one",
      maxBrokenBeforeStop: 3,
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
