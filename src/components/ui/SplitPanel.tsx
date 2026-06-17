// src/components/ui/SplitPanel.tsx
import { useState, useEffect, useRef } from "react";
import { useSplitStore, type SplitBinding } from "@/store/splitStore";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderPlus, Trash2, X, AlertCircle, Keyboard, Minus, Maximize2, GripVertical, SkipForward } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

export function SplitPanel() {
  const {
    isSplitMode, bindings, isWaitingForBinding,
    pendingFolderPath, pendingFolderName,
    startBindingMode, cancelBindingMode, addBinding, removeBinding,
    clearAllBindings, isReservedKey,
    splitAutoNext, setSplitAutoNext,
    panelWidth, panelHeight, panelPosition,
    setPanelSize, setPanelPosition,
    setBindingLastPath, getBindingLastPath,
  } = useSplitStore();

  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictData, setConflictData] = useState<{
    keyCode: string; keyDisplay: string;
    folderPath: string; folderName: string; existing: SplitBinding;
  } | null>(null);

  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [localWidth, setLocalWidth]   = useState(panelWidth);
  const [localHeight, setLocalHeight] = useState(panelHeight);
  const [localPos, setLocalPos]       = useState(panelPosition);
  const [isDragging, setIsDragging]   = useState(false);
  const [isResizingW, setIsResizingW] = useState(false);
  const [isResizingH, setIsResizingH] = useState(false);
  const dragStartRef  = useRef<{ mx: number; my: number; px: number; py: number } | null>(null);
  const resizeWRef    = useRef<{ startX: number; startW: number } | null>(null);
  const resizeHRef    = useRef<{ startY: number; startH: number } | null>(null);
  const panelRef      = useRef<HTMLDivElement>(null);

  // Синхронизируем локальное состояние со стором при первом рендере
  useEffect(() => { setLocalWidth(panelWidth); },   []);
  useEffect(() => { setLocalHeight(panelHeight); }, []);
  useEffect(() => { setLocalPos(panelPosition); },  []);

  // ── Перетаскивание панели ──────────────────────────────────────────────────
  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setIsDragging(true);
    dragStartRef.current = { mx: e.clientX, my: e.clientY, px: localPos.x, py: localPos.y };
  };

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = e.clientX - dragStartRef.current.mx;
      const dy = e.clientY - dragStartRef.current.my;
      const pw = panelRef.current?.offsetWidth  || localWidth;
      const ph = panelRef.current?.offsetHeight || localHeight;
      const nx = Math.max(0, Math.min(dragStartRef.current.px + dx, window.innerWidth  - pw));
      const ny = Math.max(0, Math.min(dragStartRef.current.py + dy, window.innerHeight - ph));
      setLocalPos({ x: nx, y: ny });
    };
    const onUp = () => {
      setIsDragging(false);
      if (dragStartRef.current) setPanelPosition(localPos.x, localPos.y);
      dragStartRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isDragging, localPos]);

  // ── Resize по ширине (правый край) ────────────────────────────────────────
  useEffect(() => {
    if (!isResizingW) return;
    const onMove = (e: MouseEvent) => {
      if (!resizeWRef.current) return;
      const dx = e.clientX - resizeWRef.current.startX;
      setLocalWidth(Math.max(240, Math.min(600, resizeWRef.current.startW + dx)));
    };
    const onUp = () => {
      setIsResizingW(false);
      setPanelSize(localWidth, localHeight);
      resizeWRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isResizingW, localWidth, localHeight]);

  // ── Resize по высоте (нижний край) ────────────────────────────────────────
  useEffect(() => {
    if (!isResizingH) return;
    const onMove = (e: MouseEvent) => {
      if (!resizeHRef.current) return;
      const dy = e.clientY - resizeHRef.current.startY;
      setLocalHeight(Math.max(200, Math.min(800, resizeHRef.current.startH + dy)));
    };
    const onUp = () => {
      setIsResizingH(false);
      setPanelSize(localWidth, localHeight);
      resizeHRef.current = null;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, [isResizingH, localWidth, localHeight]);

  // ── Key binding ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSplitMode || !isWaitingForBinding) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const keyCode = e.code;
      const keyDisplay = e.key.length === 1 ? e.key.toUpperCase() : keyCode.replace("Digit", "").replace("Key", "");
      e.preventDefault(); e.stopPropagation();
      if (isReservedKey(keyCode)) { toast.error(`❌ Key "${keyDisplay}" is reserved`); return; }
      const existing = useSplitStore.getState().getBindingByKey(keyCode);
      if (existing && pendingFolderPath && pendingFolderName) {
        setConflictData({ keyCode, keyDisplay, folderPath: pendingFolderPath, folderName: pendingFolderName, existing });
        setShowConflictDialog(true);
        return;
      }
      if (pendingFolderPath && pendingFolderName) {
        const result = addBinding(keyCode, keyDisplay, pendingFolderPath, pendingFolderName);
        if (result.success) toast.success(`✅ Bound "${pendingFolderName}" to key ${keyDisplay}`);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSplitMode, isWaitingForBinding, pendingFolderPath, pendingFolderName, addBinding, isReservedKey]);

  // ── Add folder — с памятью последней папки ────────────────────────────────
  const handleAddFolder = async () => {
    const api = window.electronAPI;
    if (!api) { toast.error("Electron API not available"); return; }
    try {
      // Используем общую память для split mode (нет binding-специфичной пока не выбрана)
      const lastPath = useSplitStore.getState().panelPosition ? undefined : undefined;
      const folderPath = await api.selectFolderWithPreview(lastPath) || await api.selectFolder();
      if (!folderPath) return;
      const folderName = folderPath.split(/[/\\]/).pop() || folderPath;
      startBindingMode(folderPath, folderName);
      toast.info(`🔑 Press any key to bind "${folderName}"`, { duration: 5000 });
    } catch (err) {
      console.error("Error in handleAddFolder:", err);
      toast.error("Failed to select folder");
    }
  };

  const handleOverwriteBinding = () => {
    if (!conflictData) return;
    removeBinding(conflictData.existing.keyCode);
    const result = addBinding(conflictData.keyCode, conflictData.keyDisplay, conflictData.folderPath, conflictData.folderName);
    if (result.success) toast.success(`✅ Rebound "${conflictData.folderName}" to key ${conflictData.keyDisplay}`);
    setShowConflictDialog(false); setConflictData(null);
  };

  const handleCancelConflict = () => {
    setShowConflictDialog(false); setConflictData(null);
    cancelBindingMode(); toast.info("Binding cancelled");
  };

  if (!isSplitMode) return null;

  return (
    <>
      <div
        ref={panelRef}
        className="fixed z-50 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
        style={{
          left: localPos.x, top: localPos.y,
          width: localWidth,
          height: isPanelCollapsed ? 'auto' : localHeight,
          WebkitAppRegion: 'no-drag' as any,
        }}
      >
        {/* Resize — правый край */}
        <div
          className="absolute right-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-primary/40 transition-colors z-10"
          onMouseDown={(e) => {
            e.preventDefault(); e.stopPropagation();
            resizeWRef.current = { startX: e.clientX, startW: localWidth };
            setIsResizingW(true);
          }}
        />

        {/* Resize — нижний край */}
        {!isPanelCollapsed && (
          <div
            className="absolute bottom-0 left-0 right-0 h-1.5 cursor-ns-resize hover:bg-primary/40 transition-colors z-10"
            onMouseDown={(e) => {
              e.preventDefault(); e.stopPropagation();
              resizeHRef.current = { startY: e.clientY, startH: localHeight };
              setIsResizingH(true);
            }}
          />
        )}

        {/* Header */}
        <div className="bg-primary/10 border-b border-border" style={{ WebkitAppRegion: 'no-drag' as any }}>
          <div className="p-3 flex items-center justify-between">
            {/* Drag handle */}
            <div
              className="flex items-center gap-2 cursor-grab select-none"
              onMouseDown={handleDragStart}
            >
              <GripVertical className="w-4 h-4 text-muted-foreground" />
              <Keyboard className="w-4 h-4 text-primary" />
              <h3 className="font-semibold text-sm">Split Mode</h3>
            </div>

            <div className="flex items-center gap-1">
              {/* ✅ Переключалка авто-перехода */}
              <Button
                size="sm" variant={splitAutoNext ? "default" : "secondary"}
                className="h-6 px-2 text-xs gap-1"
                onClick={() => {
                  setSplitAutoNext(!splitAutoNext);
                  toast.info(splitAutoNext ? "Auto-next OFF" : "Auto-next ON");
                }}
                title={splitAutoNext ? "Auto-next: ON (click to disable)" : "Auto-next: OFF (click to enable)"}
              >
                <SkipForward className="w-3 h-3" />
                {splitAutoNext ? "On" : "Off"}
              </Button>

              <Button
                size="sm" variant="ghost" className="h-6 w-6 p-0"
                onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
                title={isPanelCollapsed ? "Expand" : "Collapse"}
              >
                {isPanelCollapsed ? <Maximize2 className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
              </Button>
            </div>
          </div>
        </div>

        {!isPanelCollapsed && (
          <div className="flex flex-col overflow-hidden" style={{ height: localHeight - 52 }}>
            <div className="p-3 flex-shrink-0">
              <Button size="sm" variant="secondary" onClick={handleAddFolder} className="w-full gap-2 text-sm font-medium">
                <FolderPlus className="w-4 h-4" />
                Add Folder
              </Button>
              {isWaitingForBinding && (
                <div className="mt-2 text-xs text-yellow-600 bg-yellow-100 dark:bg-yellow-950/50 p-2 rounded animate-pulse flex items-center gap-1">
                  ⚡ Press any key to bind...
                  <Button size="sm" variant="ghost" onClick={cancelBindingMode} className="h-5 px-1 ml-auto text-xs">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>

            <ScrollArea className="flex-1 min-h-0">
              {bindings.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs p-6">
                  No folders bound yet<br />Click "Add Folder" and press a key
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {bindings.map((binding) => (
                    <div key={binding.keyCode} className="flex items-center justify-between gap-2 p-2 rounded hover:bg-accent group">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center font-mono font-bold text-sm flex-shrink-0">
                          {binding.keyDisplay}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium truncate">{binding.folderName}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{binding.folderPath}</p>
                        </div>
                      </div>
                      <Button
                        variant="ghost" size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={() => { removeBinding(binding.keyCode); toast.info(`Unbound ${binding.folderName}`); }}
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {bindings.length > 0 && (
              <div className="p-2 border-t border-border flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={clearAllBindings} className="w-full text-xs text-red-500 hover:text-red-600">
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear All Bindings
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      <Dialog open={showConflictDialog} onOpenChange={setShowConflictDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />
              Key Already Bound
            </DialogTitle>
            <DialogDescription>
              Key "{conflictData?.keyDisplay}" is already bound to "{conflictData?.existing?.folderName}"
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">Do you want to overwrite it with "{conflictData?.folderName}"?</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={handleCancelConflict}>Cancel</Button>
            <Button variant="destructive" onClick={handleOverwriteBinding}>Overwrite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}