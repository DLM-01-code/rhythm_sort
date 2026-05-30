// src/store/splitStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface SplitBinding {
  keyCode: string;        // KeyboardEvent.code (например "Digit1", "KeyF", "Quote")
  keyDisplay: string;     // Для отображения (например "1", "F", "'")
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
  
  // Actions
  setSplitMode: (enabled: boolean) => void;
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

// Зарезервированные клавиши управления плеером
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
      
      setSplitMode: (enabled) => {
        console.log(`🔄 Split mode: ${enabled ? "ON" : "OFF"}`);
        set({ isSplitMode: enabled });
        if (!enabled) {
          set({ isWaitingForBinding: false, pendingFolderPath: null, pendingFolderName: null });
        }
      },
      
      startBindingMode: (folderPath, folderName) => {
        set({
          isWaitingForBinding: true,
          pendingFolderPath: folderPath,
          pendingFolderName: folderName
        });
        console.log(`⌨️ Waiting for key binding for folder: ${folderName}`);
      },
      
      cancelBindingMode: () => {
        set({
          isWaitingForBinding: false,
          pendingFolderPath: null,
          pendingFolderName: null
        });
        console.log(`❌ Key binding cancelled`);
      },
      
      addBinding: (keyCode, keyDisplay, folderPath, folderName) => {
        const existing = get().bindings.find(b => b.keyCode === keyCode);
        if (existing) {
          console.warn(`⚠️ Key ${keyDisplay} already bound to ${existing.folderName}`);
          return { success: false, conflict: existing };
        }
        
        const newBinding: SplitBinding = {
          keyCode,
          keyDisplay,
          folderPath,
          folderName,
          createdAt: Date.now()
        };
        
        set((state) => ({
          bindings: [...state.bindings, newBinding],
          isWaitingForBinding: false,
          pendingFolderPath: null,
          pendingFolderName: null
        }));
        
        console.log(`✅ Bound ${folderName} to key ${keyDisplay} (${keyCode})`);
        return { success: true };
      },
      
      removeBinding: (keyCode) => {
        set((state) => ({
          bindings: state.bindings.filter(b => b.keyCode !== keyCode)
        }));
        console.log(`🗑️ Removed binding for key: ${keyCode}`);
      },
      
      getBindingByKey: (keyCode) => {
        return get().bindings.find(b => b.keyCode === keyCode);
      },
      
      getAllBindings: () => {
        return get().bindings;
      },
      
      clearAllBindings: () => {
        set({ bindings: [] });
        console.log(`🗑️ All split bindings cleared`);
      },
      
      isReservedKey: (keyCode) => {
        return RESERVED_KEYS.has(keyCode);
      },
      
      getSortedBindings: () => {
        return [...get().bindings].sort((a, b) => a.keyDisplay.localeCompare(b.keyDisplay));
      }
    }),
    {
      name: "rhythm-sort-split-bindings",
    }
  )
);