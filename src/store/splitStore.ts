// src/store/splitStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SplitBinding {
  keyCode: string;
  keyDisplay: string;
  folderPath: string;
  folderName: string;
  createdAt: number;
}

interface SplitState {
  isSplitMode: boolean;
  bindings: SplitBinding[];
  isWaitingForBinding: boolean;
  pendingFolderPath: string | null;
  pendingFolderName: string | null;
  splitAutoNext: boolean; // ✅ переключатель авто-перехода в Split Mode

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
      splitAutoNext: true, // по умолчанию авто-переход включён

      setSplitMode: (enabled) => {
        set({ isSplitMode: enabled });
        if (!enabled) {
          set({ isWaitingForBinding: false, pendingFolderPath: null, pendingFolderName: null });
        }
      },

      setSplitAutoNext: (v) => set({ splitAutoNext: v }),

      startBindingMode: (folderPath, folderName) => {
        set({ isWaitingForBinding: true, pendingFolderPath: folderPath, pendingFolderName: folderName });
      },

      cancelBindingMode: () => {
        set({ isWaitingForBinding: false, pendingFolderPath: null, pendingFolderName: null });
      },

      addBinding: (keyCode, keyDisplay, folderPath, folderName) => {
        const existing = get().bindings.find(b => b.keyCode === keyCode);
        if (existing) return { success: false, conflict: existing };
        const newBinding: SplitBinding = { keyCode, keyDisplay, folderPath, folderName, createdAt: Date.now() };
        set((state) => ({
          bindings: [...state.bindings, newBinding],
          isWaitingForBinding: false,
          pendingFolderPath: null,
          pendingFolderName: null
        }));
        return { success: true };
      },

      removeBinding: (keyCode) => {
        set((state) => ({ bindings: state.bindings.filter(b => b.keyCode !== keyCode) }));
      },

      getBindingByKey: (keyCode) => get().bindings.find(b => b.keyCode === keyCode),
      getAllBindings: () => get().bindings,
      clearAllBindings: () => set({ bindings: [] }),
      isReservedKey: (keyCode) => RESERVED_KEYS.has(keyCode),
      getSortedBindings: () => [...get().bindings].sort((a, b) => a.keyDisplay.localeCompare(b.keyDisplay)),
    }),
    { name: "rhythm-sort-split-bindings" }
  )
);
