// src/components/ui/SplitPanel.tsx
import { useState, useEffect, useRef } from "react";
import { useSplitStore, type SplitBinding } from "@/store/splitStore";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FolderPlus, Trash2, X, AlertCircle, Keyboard, Minus, Maximize2, GripVertical } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function SplitPanel() {
  const {
    isSplitMode,
    bindings,
    isWaitingForBinding,
    pendingFolderPath,
    pendingFolderName,
    startBindingMode,
    cancelBindingMode,
    addBinding,
    removeBinding,
    clearAllBindings,
    isReservedKey,
  } = useSplitStore();

  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictData, setConflictData] = useState<{
    keyCode: string;
    keyDisplay: string;
    folderPath: string;
    folderName: string;
    existing: SplitBinding;
  } | null>(null);
  
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('split-panel-pos');
    if (saved) {
      try {
        const pos = JSON.parse(saved);
        setPosition(pos);
      } catch(e) {}
    }
  }, []);

  useEffect(() => {
    if (!isDragging) {
      localStorage.setItem('split-panel-pos', JSON.stringify(position));
    }
  }, [position, isDragging]);

  const handleDragStart = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target.closest('.drag-handle')) return;
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
  };

  useEffect(() => {
    if (!isDragging) return;
    const handleMouseMove = (e: MouseEvent) => {
      let newX = e.clientX - dragStart.x;
      let newY = e.clientY - dragStart.y;
      const panelWidth = panelRef.current?.offsetWidth || 320;
      const panelHeight = panelRef.current?.offsetHeight || 400;
      newX = Math.max(0, Math.min(newX, window.innerWidth - panelWidth));
      newY = Math.max(0, Math.min(newY, window.innerHeight - panelHeight));
      setPosition({ x: newX, y: newY });
    };
    const handleMouseUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragStart]);

  useEffect(() => {
    if (!isSplitMode || !isWaitingForBinding) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      const keyCode = e.code;
      const keyDisplay = e.key.length === 1 ? e.key.toUpperCase() :
                         keyCode.replace("Digit", "").replace("Key", "");
      e.preventDefault();
      e.stopPropagation();
      if (isReservedKey(keyCode)) {
        toast.error(`❌ Key "${keyDisplay}" is reserved for player controls`);
        return;
      }
      const existing = useSplitStore.getState().getBindingByKey(keyCode);
      if (existing && pendingFolderPath && pendingFolderName) {
        setConflictData({ keyCode, keyDisplay, folderPath: pendingFolderPath, folderName: pendingFolderName, existing });
        setShowConflictDialog(true);
        return;
      }
      if (pendingFolderPath && pendingFolderName) {
        const result = addBinding(keyCode, keyDisplay, pendingFolderPath, pendingFolderName);
        if (result.success) {
          toast.success(`✅ Bound "${pendingFolderName}" to key ${keyDisplay}`);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isSplitMode, isWaitingForBinding, pendingFolderPath, pendingFolderName, addBinding, isReservedKey]);

  const handleAddFolder = async () => {
    const api = window.electronAPI;
    if (!api) { toast.error("Electron API not available"); return; }
    const folderPath = await api.selectFolderWithPreview();
    if (!folderPath) return;
    const folderName = folderPath.split(/[/\\]/).pop() || folderPath;
    startBindingMode(folderPath, folderName);
    toast.info(`🔑 Press any key to bind "${folderName}"`, { duration: 5000 });
  };

  const handleOverwriteBinding = () => {
    if (conflictData) {
      removeBinding(conflictData.existing.keyCode);
      const result = addBinding(conflictData.keyCode, conflictData.keyDisplay, conflictData.folderPath, conflictData.folderName);
      if (result.success) {
        toast.success(`✅ Rebound "${conflictData.folderName}" to key ${conflictData.keyDisplay}`);
      }
      setShowConflictDialog(false);
      setConflictData(null);
    }
  };

  const handleCancelConflict = () => {
    setShowConflictDialog(false);
    setConflictData(null);
    cancelBindingMode();
    toast.info("Binding cancelled");
  };

  if (!isSplitMode) return null;

  return (
    <>
      <div
        ref={panelRef}
        className="fixed z-50 w-80 bg-card border border-border rounded-lg shadow-lg overflow-hidden"
        style={{ left: position.x, top: position.y, cursor: isDragging ? 'grabbing' : 'default' }}
      >
        <div
          className="drag-handle p-3 bg-primary/10 border-b border-border flex items-center justify-between cursor-grab active:cursor-grabbing select-none"
          onMouseDown={handleDragStart}
        >
          <div className="flex items-center gap-2 pointer-events-none">
            <GripVertical className="w-4 h-4 text-muted-foreground" />
            <Keyboard className="w-4 h-4 text-primary" />
            <h3 className="font-semibold text-sm">Split Mode</h3>
          </div>
          <div className="flex items-center gap-1 pointer-events-auto">
            <Button
              size="sm"
              variant="ghost"
              className="h-6 w-6 p-0"
              onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}
              title={isPanelCollapsed ? "Expand" : "Collapse"}
            >
              {isPanelCollapsed ? <Maximize2 className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
            </Button>
          </div>
        </div>

        {!isPanelCollapsed && (
          <>
            <div className="p-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={handleAddFolder}
                className="w-full gap-2 text-sm font-medium"
              >
                <FolderPlus className="w-4 h-4" />
                Add Folder
              </Button>

              {isWaitingForBinding && (
                <div className="mt-2 text-xs text-yellow-600 bg-yellow-100 dark:bg-yellow-950/50 p-2 rounded animate-pulse">
                  ⚡ Waiting for key binding... Press any key (except reserved)
                  <Button size="sm" variant="ghost" onClick={cancelBindingMode} className="h-5 px-1 ml-2 text-xs">
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              )}
            </div>

            <ScrollArea className="max-h-80">
              {bindings.length === 0 ? (
                <div className="text-center text-muted-foreground text-xs p-6">
                  No folders bound yet<br />
                  Click "Add Folder" and press a key
                </div>
              ) : (
                <div className="p-2 space-y-1">
                  {bindings.map((binding) => (
                    <div
                      key={binding.keyCode}
                      className="flex items-center justify-between gap-2 p-2 rounded hover:bg-accent group"
                    >
                      {/* ✅ Слева: номер */}
                      <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground flex-shrink-0">
                        {bindings.indexOf(binding) + 1}
                      </div>

                      {/* ✅ Центр: сверху клавиша, снизу путь */}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-primary">
                          Key: {binding.keyDisplay}
                        </p>
                        <p className="text-[10px] text-muted-foreground truncate" title={binding.folderPath}>
                          {binding.folderPath}
                        </p>
                      </div>

                      {/* ✅ Справа: кнопка удалить */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        onClick={() => {
                          removeBinding(binding.keyCode);
                          toast.info(`Unbound ${binding.folderName} from key ${binding.keyDisplay}`);
                        }}
                      >
                        <Trash2 className="w-3 h-3 text-red-500" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {bindings.length > 0 && (
              <div className="p-2 border-t border-border">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllBindings}
                  className="w-full text-xs text-red-500 hover:text-red-600"
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear All Bindings
                </Button>
              </div>
            )}
          </>
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
