import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings as SettingsIcon, Trash2, ArrowRight, Folder, Download, Upload, AlertTriangle, Loader2, Split, Eye, EyeOff, SkipForward } from "lucide-react";
import { usePlayer, type Track } from "@/store/playerStore";
import { useSettings } from "@/store/settingsStore";
import { useSplitStore } from "@/store/splitStore";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

let idCounter = 0;
const nextId = () => `t_${Date.now()}_${idCounter++}`;
const isBrowser = typeof window !== 'undefined';

const AUDIO_EXTS = new Set([
  "mp3", "wav", "flac", "aac", "ogg", "m4a", "m4b", "m4r", "m4p",
  "mp4", "mpeg", "mpga", "mp2", "mpa", "opus", "wma", "wmv",
  "aiff", "aif", "aifc", "caf", "alac", "ape", "dsf", "dff",
  "dvf", "gsm", "ircam", "m3u", "mka", "mlp", "ra", "rm",
  "snd", "tak", "tta", "voc", "vox", "wv", "m4v", "mkv", "mov", "3gp", "webm"
]);

const SKIP_FILES = new Set([
  'Thumbs.db', 'desktop.ini', '.localized', 'Icon\r'
]);

function isSystemFile(filename: string): boolean {
  return SKIP_FILES.has(filename);
}

function isSameFolder(folder1: string | null, folder2: string | null): boolean {
  if (!folder1 || !folder2) return false;
  const normalize = (p: string) => p.toLowerCase().replace(/\\/g, '/').replace(/\/$/, '');
  return normalize(folder1) === normalize(folder2);
}

function truncatePath(path: string, maxLength: number = 35): string {
  if (!path) return "";
  if (path.length <= maxLength) return path;
  const parts = path.split(/[\\/]/);
  if (parts.length <= 2) return "..." + path.slice(-maxLength);
  return "..." + parts.slice(-2).join('/');
}

export function Toolbar({ onOpenSettings }: { onOpenSettings: () => void }) {
  const setTracks = usePlayer((s) => s.setTracks);
  const clearBrokenTracks = usePlayer((s) => s.clearBrokenTracks);
  const resetPlayer = usePlayer((s) => s.reset);
  const sourceFolder = usePlayer((s) => s.sourceFolder);
  const targetFolder = useSettings((s) => s.targetFolder);
  const autoPlayAfterLoad = useSettings((s) => s.autoPlayAfterLoad);
  const autoPlayNext = useSettings((s) => s.autoPlayNext);
  const vizEnabled = useSettings((s) => s.vizEnabled);
  const acceptMode = useSettings((s) => s.acceptMode);
  const set = useSettings((s) => s.set);
  const clearFolders = useSettings((s) => s.clearFolders);
  const clearProcessed = usePlayer((s) => s.clearProcessed);
  const { isSplitMode, setSplitMode } = useSplitStore();
  const [scanning, setScanning] = useState(false);
  const [showBrokenDialog, setShowBrokenDialog] = useState(false);
  const [brokenFilesList, setBrokenFilesList] = useState<Track[]>([]);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanTotal, setScanTotal] = useState(0);
  const [showProgress, setShowProgress] = useState(false);

  const pickSourceFolder = useCallback(async () => {
    if (scanning) return;
    setScanning(true);
    try {
      const api = isBrowser ? window.electronAPI : null;
      if (api) {
        const folder = await api.selectFolderWithPreview();
        if (!folder) return;
        if (isSameFolder(folder, targetFolder)) {
          toast.error("Source folder cannot be the same as Target folder!");
          setScanning(false);
          return;
        }
        clearProcessed();
        clearBrokenTracks();
        idCounter = 0;
        const files = await api.scanFolder(folder);
        const audioFiles = files.filter(f => !isSystemFile(f.name));
        const tracks: Track[] = audioFiles.map((f) => ({
          ...f,
          id: nextId(),
          status: "pending"
        }));
        setScanTotal(tracks.length);
        setScanProgress(100);
        setShowProgress(true);
        setTimeout(() => setShowProgress(false), 500);
        if (tracks.length === 0) {
          toast.error("No files found in this folder");
          setScanning(false);
          return;
        }
        setTracks(tracks, folder);
        toast.success(`Loaded ${tracks.length} tracks`);
        if (autoPlayAfterLoad && tracks.length > 0) {
          setTimeout(() => {
            const { tracks: stateTracks, setIndex, setIsPlaying } = usePlayer.getState();
            if (stateTracks.length > 0) {
              setIndex(0);
              setIsPlaying(true);
              const audio = document.querySelector('audio');
              if (audio) audio.play().catch(e => console.log('Auto-play failed:', e));
            }
          }, 100);
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to load folder");
    } finally {
      setScanning(false);
    }
  }, [clearProcessed, targetFolder, clearBrokenTracks, scanning, autoPlayAfterLoad, setTracks]);

  const pickTargetFolder = useCallback(async () => {
    const api = isBrowser ? window.electronAPI : null;
    if (api) {
      const folder = await api.selectFolderWithPreview();
      if (folder) {
        if (isSameFolder(folder, sourceFolder)) {
          toast.error("Target folder cannot be the same as Source folder!");
          return;
        }
        const exists = await api.checkFolderExists(folder);
        if (!exists) {
          toast.error("This folder no longer exists. Please select another folder.");
          return;
        }
        set("targetFolder", folder);
        toast.success(`Target folder set: ${folder}`);
      }
    } else {
      toast.info("Folder picking requires the desktop app");
    }
  }, [set, sourceFolder]);

  const handleToggleSplitMode = () => {
    const newMode = !isSplitMode;
    setSplitMode(newMode);
    toast.info(newMode ? "Split Mode ON - Add folders and bind keys" : "Split Mode OFF", { duration: 3000 });
  };

  const handleToggleVisualizer = () => {
    set("vizEnabled", !vizEnabled);
    toast.info(vizEnabled ? "Visualizer disabled" : "Visualizer enabled");
  };

  const handleToggleAutoPlay = () => {
    set("autoPlayNext", !autoPlayNext);
    toast.info(autoPlayNext ? "Auto-play OFF" : "Auto-play ON");
  };

  // ✅ Переключалка Copy/Move
  const handleToggleAcceptMode = () => {
    const newMode = acceptMode === "copy" ? "move" : "copy";
    set("acceptMode", newMode);
    toast.info(newMode === "move" ? "Accept Mode: Move (file will be deleted from source)" : "Accept Mode: Copy (file stays in source)");
  };

  const handleFullReset = useCallback(() => {
    resetPlayer();
    clearFolders();
    clearProcessed();
    clearBrokenTracks();
    idCounter = 0;
    setShowBrokenDialog(false);
    setBrokenFilesList([]);
    setScanProgress(0);
    setScanTotal(0);
    setShowProgress(false);
    toast.success("Everything reset! Source and Target folders cleared, queue emptied.");
  }, [resetPlayer, clearFolders, clearProcessed, clearBrokenTracks]);

  return (
    <>
      <div className="flex flex-col border-b border-border bg-card/60 backdrop-blur">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <span className="text-primary text-sm font-bold">♪</span>
            </div>
            <span className="font-semibold tracking-tight">Rhythm Sort</span>

            <Button
              size="sm"
              variant={isSplitMode ? "default" : "secondary"}
              onClick={handleToggleSplitMode}
              className="gap-2 ml-4 font-medium"
              disabled={scanning}
            >
              <Split className="w-4 h-4" />
              Split
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="destructive"
              onClick={handleFullReset}
              title="Reset everything"
              className="gap-1 font-medium"
              disabled={scanning}
            >
              <Trash2 className="w-4 h-4" />
              Reset All
            </Button>

            {/* ✅ Accept Mode Toggle: C = Copy, M = Move */}
            <Button
              size="sm"
              variant={acceptMode === "move" ? "default" : "secondary"}
              onClick={handleToggleAcceptMode}
              title={acceptMode === "move" ? "Accept Mode: Move (click to switch to Copy)" : "Accept Mode: Copy (click to switch to Move)"}
              className="font-mono font-bold w-8 h-8 p-0"
              disabled={scanning}
            >
              {acceptMode === "move" ? "M" : "C"}
            </Button>

            {/* Auto-play Toggle */}
            <Button
              size="sm"
              variant={autoPlayNext ? "default" : "secondary"}
              onClick={handleToggleAutoPlay}
              title={autoPlayNext ? "Auto-play ON" : "Auto-play OFF"}
              className="font-medium"
            >
              <SkipForward className="w-4 h-4" />
            </Button>

            {/* Visualizer Toggle */}
            <Button
              size="sm"
              variant={vizEnabled ? "default" : "secondary"}
              onClick={handleToggleVisualizer}
              title={vizEnabled ? "Disable visualizer" : "Enable visualizer"}
              className="font-medium"
            >
              {vizEnabled ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>

            {isBrowser && !window.electronAPI && (
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Browser preview · file ops require desktop app
              </span>
            )}
            <Button size="sm" variant="secondary" onClick={onOpenSettings} className="font-medium">
              <SettingsIcon className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {showProgress && (
          <div className="px-4 py-2 bg-muted/30">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Loading tracks...</span>
              <span>{scanTotal} files loaded</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
              <div className="bg-primary h-2 rounded-full transition-all duration-300" style={{ width: `100%` }} />
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-6 px-4 py-4 bg-muted/20">
          <div
            className={cn(
              "flex-1 max-w-sm rounded-xl border-2 transition-all cursor-pointer",
              scanning ? "opacity-50 cursor-wait" : "",
              sourceFolder
                ? "border-solid border-primary/50 bg-card"
                : "border-dashed border-border bg-card hover:border-primary/50",
            )}
            onClick={pickSourceFolder}
          >
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                {scanning ? (
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                ) : (
                  <Upload className={cn("w-5 h-5", sourceFolder ? "text-primary" : "text-muted-foreground")} />
                )}
                <span className="text-sm font-medium">Source Folder</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Folder className="w-4 h-4" />
                <span className="truncate max-w-[250px]">
                  {sourceFolder ? truncatePath(sourceFolder) : "Click to select folder"}
                </span>
              </div>
              {sourceFolder && (
                <div className="mt-2 text-[10px] text-primary/70">📁 Ready to import</div>
              )}
            </div>
          </div>

          <div className="flex-shrink-0">
            <ArrowRight className="w-6 h-6 text-muted-foreground" />
          </div>

          <div
            className={cn(
              "flex-1 max-w-sm rounded-xl border-2 transition-all cursor-pointer",
              targetFolder
                ? "border-solid border-green-500/50 bg-card"
                : "border-dashed border-border bg-card hover:border-primary/50",
            )}
            onClick={pickTargetFolder}
          >
            <div className="p-4 text-center">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Download className={cn("w-5 h-5", targetFolder ? "text-green-500" : "text-muted-foreground")} />
                <span className="text-sm font-medium">Target Folder</span>
              </div>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <Folder className="w-4 h-4" />
                <span className="truncate max-w-[250px]">
                  {targetFolder ? truncatePath(targetFolder) : "Click to select folder"}
                </span>
              </div>
              {targetFolder && (
                <div className="mt-2 text-[10px] text-green-500/70">✓ Ready to accept tracks</div>
              )}
            </div>
          </div>
        </div>
      </div>

      <Dialog open={showBrokenDialog} onOpenChange={setShowBrokenDialog}>
        <DialogContent className="max-w-lg max-h-[60vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-yellow-500">
              <AlertTriangle className="w-5 h-5" />
              Broken Files Detected
            </DialogTitle>
            <DialogDescription>
              The following files appear to be corrupted or unreadable and will be skipped:
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 mt-4 max-h-[300px] overflow-y-auto">
            {brokenFilesList.map((file, idx) => (
              <div key={idx} className="flex items-center gap-2 p-2 bg-muted/30 rounded text-sm">
                <AlertTriangle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                <span className="break-all text-xs">{file.name}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-between gap-2 mt-4">
            <Button variant="outline" onClick={() => {
              const text = brokenFilesList.map(f => f.name).join('\n');
              navigator.clipboard.writeText(text);
              toast.success("Broken files list copied");
            }} className="flex-1">
              Copy List
            </Button>
            <Button onClick={() => setShowBrokenDialog(false)} className="flex-1">
              Continue
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
