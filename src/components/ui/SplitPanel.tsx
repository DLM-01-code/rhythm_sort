// src/components/ui/SplitPanel.tsx
import { useState, useEffect, useRef } from "react";
import { useSplitStore, type SplitBinding } from "@/store/splitStore";
import { Button } from "@/components/ui/button";
import { FolderPlus, Trash2, X, AlertCircle, Keyboard, Minus, Maximize2, GripVertical, SkipForward } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogDescription,
  DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

function getLastFolder(p: string): string {
  return p.split(/[/\\]/).filter(Boolean).pop() || p;
}

export function SplitPanel() {
  const {
    isSplitMode, bindings, isWaitingForBinding,
    pendingFolderPath, pendingFolderName, splitAutoNext,
    startBindingMode, cancelBindingMode, addBinding,
    removeBinding, clearAllBindings, isReservedKey, setSplitAutoNext,
  } = useSplitStore();

  const [showConflict, setShowConflict] = useState(false);
  const [conflictData, setConflictData] = useState<{
    keyCode: string; keyDisplay: string;
    folderPath: string; folderName: string; existing: SplitBinding;
  } | null>(null);

  const [collapsed, setCollapsed] = useState(false);
  const [pos, setPos] = useState({ x: 100, y: 100 });
  const [sz, setSz] = useState({ w: 320, h: 420 });
  const [dragging, setDragging] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, w: 320, h: 420 });
  const [expandedKey, setExpandedKey] = useState<string | null>(null);

  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem("split-panel-state") || "{}");
      if (s.pos) setPos(s.pos);
      if (s.sz) setSz(s.sz);
    } catch {}
  }, []);

  useEffect(() => {
    if (!dragging && !resizing) {
      localStorage.setItem("split-panel-state", JSON.stringify({ pos, sz }));
    }
  }, [pos, sz, dragging, resizing]);

  // Drag
  const onDragStart = (e: React.MouseEvent) => {
    if (!(e.target as HTMLElement).closest(".drag-handle")) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pos.x, y: e.clientY - pos.y });
  };
  useEffect(() => {
    if (!dragging) return;
    const mv = (e: MouseEvent) => setPos({
      x: Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - sz.w)),
      y: Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - 60)),
    });
    const up = () => setDragging(false);
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
  }, [dragging, dragStart, sz.w]);

  // Resize
  const onResizeStart = (e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation();
    setResizing(true);
    setResizeStart({ x: e.clientX, y: e.clientY, w: sz.w, h: sz.h });
  };
  useEffect(() => {
    if (!resizing) return;
    const mv = (e: MouseEvent) => setSz({
      w: Math.max(260, resizeStart.w + e.clientX - resizeStart.x),
      h: Math.max(200, resizeStart.h + e.clientY - resizeStart.y),
    });
    const up = () => setResizing(false);
    window.addEventListener("mousemove", mv);
    window.addEventListener("mouseup", up);
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); };
  }, [resizing, resizeStart]);

  // Key binding
  useEffect(() => {
    if (!isSplitMode || !isWaitingForBinding) return;
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA") return;
      const kc = e.code;
      const kd = e.key.length === 1 ? e.key.toUpperCase() : kc.replace("Digit","").replace("Key","");
      e.preventDefault(); e.stopPropagation();
      if (isReservedKey(kc)) { toast.error(`Key "${kd}" is reserved`); return; }
      const ex = useSplitStore.getState().getBindingByKey(kc);
      if (ex && pendingFolderPath && pendingFolderName) {
        setConflictData({ keyCode: kc, keyDisplay: kd, folderPath: pendingFolderPath, folderName: pendingFolderName, existing: ex });
        setShowConflict(true); return;
      }
      if (pendingFolderPath && pendingFolderName) {
        const r = addBinding(kc, kd, pendingFolderPath, pendingFolderName);
        if (r.success) toast.success(`Bound "${pendingFolderName}" to ${kd}`);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isSplitMode, isWaitingForBinding, pendingFolderPath, pendingFolderName, addBinding, isReservedKey]);

  const handleAddFolder = async () => {
    const api = window.electronAPI;
    if (!api) return;
    const fp = await api.selectFolderWithPreview();
    if (!fp) return;
    const fn = fp.split(/[/\\]/).pop() || fp;
    startBindingMode(fp, fn);
    toast.info(`Press any key to bind "${fn}"`, { duration: 5000 });
  };

  const doOverwrite = () => {
    if (!conflictData) return;
    removeBinding(conflictData.existing.keyCode);
    addBinding(conflictData.keyCode, conflictData.keyDisplay, conflictData.folderPath, conflictData.folderName);
    toast.success(`Rebound to ${conflictData.keyDisplay}`);
    setShowConflict(false); setConflictData(null);
  };

  const cancelConflict = () => {
    setShowConflict(false); setConflictData(null);
    cancelBindingMode(); toast.info("Cancelled");
  };

  if (!isSplitMode) return null;

  return (
    <>
      <div
        className="fixed z-50 bg-card border border-border rounded-lg shadow-xl overflow-hidden select-none flex flex-col"
        style={{ left: pos.x, top: pos.y, width: sz.w, cursor: dragging ? "grabbing" : "default" }}
      >
        {/* Header */}
        <div
          className="drag-handle px-3 py-2 bg-primary/10 border-b border-border flex items-center justify-between cursor-grab active:cursor-grabbing flex-shrink-0"
          onMouseDown={onDragStart}
        >
          <div className="flex items-center gap-2 pointer-events-none">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
            <Keyboard className="w-4 h-4 text-primary" />
            <span className="font-semibold text-sm">Split Mode</span>
          </div>
          <div className="flex items-center gap-1 pointer-events-auto">
            <Button
              size="sm"
              variant={splitAutoNext ? "default" : "secondary"}
              className="h-6 px-2 text-[10px] gap-1"
              onClick={() => setSplitAutoNext(!splitAutoNext)}
              title={splitAutoNext ? "Auto-next ON" : "Auto-next OFF — stays on current track"}
            >
              <SkipForward className="w-3 h-3" />
              {splitAutoNext ? "Auto" : "Stay"}
            </Button>
            <Button size="sm" variant="ghost" className="h-6 w-6 p-0"
              onClick={() => setCollapsed(!collapsed)}>
              {collapsed ? <Maximize2 className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            </Button>
          </div>
        </div>

        {!collapsed && (
          <>
            <div className="p-3 flex-shrink-0">
              <Button size="sm" variant="secondary" onClick={handleAddFolder} className="w-full gap-2 text-sm">
                <FolderPlus className="w-4 h-4" /> Add Folder
              </Button>
              {isWaitingForBinding && (
                <div className="mt-2 text-xs text-yellow-600 bg-yellow-950/40 p-2 rounded animate-pulse flex items-center justify-between">
                  <span>⚡ Press any key to bind...</span>
                  <Button size="sm" variant="ghost" onClick={cancelBindingMode} className="h-5 px-1">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>

            {/* Bindings */}
            <div
              className="overflow-y-auto px-2 pb-1 flex-1"
              style={{ maxHeight: Math.max(80, sz.h - 170) }}
            >
              {bindings.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs py-6">
                  No folders bound yet<br />Add a folder and press a key
                </div>
              ) : (
                <div className="space-y-1">
                  {bindings.map((b, i) => (
                    <div key={b.keyCode} className="flex items-start gap-2 p-2 rounded hover:bg-accent group transition-colors">
                      <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-[9px] font-bold text-muted-foreground flex-shrink-0 mt-0.5">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-primary leading-tight">Key: {b.keyDisplay}</p>
                        {/* Клик показывает полный путь */}
                        <button
                          className="text-left w-full mt-0.5"
                          onClick={() => setExpandedKey(expandedKey === b.keyCode ? null : b.keyCode)}
                          title={expandedKey === b.keyCode ? "Click to collapse" : "Click to show full path"}
                        >
                          {expandedKey === b.keyCode ? (
                            <p className="text-[10px] text-muted-foreground break-all leading-tight">{b.folderPath}</p>
                          ) : (
                            <p className="text-[10px] text-muted-foreground truncate leading-tight">
                              📁 {getLastFolder(b.folderPath)}
                            </p>
                          )}
                        </button>
                      </div>
                      <Button
                        variant="ghost" size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={() => { removeBinding(b.keyCode); toast.info(`Unbound key ${b.keyDisplay}`); }}
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {bindings.length > 0 && (
              <div className="px-2 pb-2 pt-1 border-t border-border flex-shrink-0">
                <Button variant="ghost" size="sm" onClick={clearAllBindings}
                  className="w-full text-xs text-red-500 hover:text-red-600">
                  <Trash2 className="w-3 h-3 mr-1" /> Clear All Bindings
                </Button>
              </div>
            )}
          </>
        )}

        {/* ✅ Resize grip */}
        {!collapsed && (
          <div
            className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize z-10 flex items-end justify-end pr-0.5 pb-0.5"
            onMouseDown={onResizeStart}
          >
            <svg width="10" height="10" viewBox="0 0 10 10" className="opacity-30">
              <line x1="10" y1="0" x2="0" y2="10" stroke="currentColor" strokeWidth="1.5"/>
              <line x1="10" y1="4" x2="4" y2="10" stroke="currentColor" strokeWidth="1.5"/>
            </svg>
          </div>
        )}
      </div>

      <Dialog open={showConflict} onOpenChange={setShowConflict}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-500" />Key Already Bound
            </DialogTitle>
            <DialogDescription>
              Key "{conflictData?.keyDisplay}" is already bound to "{conflictData?.existing?.folderName}"
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <p className="text-sm">Overwrite with "{conflictData?.folderName}"?</p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={cancelConflict}>Cancel</Button>
            <Button variant="destructive" onClick={doOverwrite}>Overwrite</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
