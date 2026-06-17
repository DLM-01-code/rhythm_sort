// src/store/splitStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SplitBinding {
  keyCode: string;
  keyDisplay: string;
  folderPath: string;
  folderName: string;
  createdAt: number;
  lastOpenedPath?: string; // память последней открытой папки для этого биндинга
}

interface SplitState {
  isSplitMode: boolean;
  bindings: SplitBinding[];
  isWaitingForBinding: boolean;
  pendingFolderPath: string | null;
  pendingFolderName: string | null;
  splitAutoNext: boolean;
  panelWidth: number;
  panelHeight: number;
  panelPosition: { x: number; y: number };

  setSplitMode: (enabled: boolean) => void;
  setSplitAutoNext: (v: boolean) => void;
  startBindingMode: (folderPath: string, folderName: string) => void;
  cancelBindingMode: () => void;
  addBinding: (keyCode: string, keyDisplay: string, folderPath: string, folderName: string) => { success: boolean; conflict?: SplitBinding };
  removeBinding: (keyCode: string) => void;
  getBindingByKey: (keyCode: string) => SplitBinding | undefined;
  getAllBindings: () => SplitBinding[];
  clearAllBindings: () => void;
  isReservedKey: (keyCode: string) => boolean;
  getSortedBindings: () => SplitBinding[];
  setBindingLastPath: (keyCode: string, lastPath: string) => void;
  getBindingLastPath: (keyCode: string) => string | undefined;
  setPanelSize: (width: number, height: number) => void;
  setPanelPosition: (x: number, y: number) => void;
}

const RESERVED_KEYS = new Set([
  "ArrowRight", "ArrowLeft", "Space", "ArrowUp", "ArrowDown",
  "KeyA", "KeyD", "KeyW", "KeyS"
]);

export const useSplitStore = create<SplitState>()(
  persist(
    (set, get) => ({
      isSplitMode: false,
      bindings: [],
      isWaitingForBinding: false,
      pendingFolderPath: null,
      pendingFolderName: null,
      splitAutoNext: true,
      panelWidth: 320,
      panelHeight: 400,
      panelPosition: { x: 100, y: 100 },

      setSplitMode: (enabled) => {
        set({ isSplitMode: enabled });
        if (!enabled) set({ isWaitingForBinding: false, pendingFolderPath: null, pendingFolderName: null });
      },

      setSplitAutoNext: (v) => set({ splitAutoNext: v }),

      startBindingMode: (folderPath, folderName) =>
        set({ isWaitingForBinding: true, pendingFolderPath: folderPath, pendingFolderName: folderName }),

      cancelBindingMode: () =>
        set({ isWaitingForBinding: false, pendingFolderPath: null, pendingFolderName: null }),

      addBinding: (keyCode, keyDisplay, folderPath, folderName) => {
        const existing = get().bindings.find(b => b.keyCode === keyCode);
        if (existing) return { success: false, conflict: existing };
        set((s) => ({
          bindings: [...s.bindings, { keyCode, keyDisplay, folderPath, folderName, createdAt: Date.now() }],
          isWaitingForBinding: false,
          pendingFolderPath: null,
          pendingFolderName: null,
        }));
        return { success: true };
      },

      removeBinding: (keyCode) =>
        set((s) => ({ bindings: s.bindings.filter(b => b.keyCode !== keyCode) })),

      getBindingByKey: (keyCode) => get().bindings.find(b => b.keyCode === keyCode),
      getAllBindings: () => get().bindings,
      clearAllBindings: () => set({ bindings: [] }),
      isReservedKey: (keyCode) => RESERVED_KEYS.has(keyCode),
      getSortedBindings: () => [...get().bindings].sort((a, b) => a.keyDisplay.localeCompare(b.keyDisplay)),

      // Память последней папки для конкретного биндинга
      setBindingLastPath: (keyCode, lastPath) =>
        set((s) => ({
          bindings: s.bindings.map(b => b.keyCode === keyCode ? { ...b, lastOpenedPath: lastPath } : b)
        })),

      getBindingLastPath: (keyCode) =>
        get().bindings.find(b => b.keyCode === keyCode)?.lastOpenedPath,

      setPanelSize: (width, height) => set({ panelWidth: width, panelHeight: height }),
      setPanelPosition: (x, y) => set({ panelPosition: { x, y } }),
    }),
    { name: "rhythm-sort-split-bindings" }
  )
);
