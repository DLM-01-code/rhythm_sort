import { useState, useEffect } from "react";
import { usePlayer } from "@/store/playerStore";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Copy, Trash2, ChevronUp, ChevronDown, Save } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export function BrokenFiles() {
  const { brokenTracks, clearBrokenTracks, sourceFolder } = usePlayer();
  const [isExpanded, setIsExpanded] = useState(true);

  // ДОБАВЬ ЭТОТ ЛОГ
  console.log('🔄 BrokenFiles RENDER, brokenTracks count:', brokenTracks.length);
  console.log('📋 Broken files list:', brokenTracks.map(t => t.name));

  // ДОБАВЬ ЭФФЕКТ ДЛЯ ОТСЛЕЖИВАНИЯ ИЗМЕНЕНИЙ
  useEffect(() => {
    console.log('💥 brokenTracks CHANGED! New count:', brokenTracks.length);
  }, [brokenTracks.length, brokenTracks]);

  if (brokenTracks.length === 0) return null;

  const copyAllNames = () => {
    const text = brokenTracks.map(t => t.name).join('\n');
    navigator.clipboard.writeText(text);
    toast.success(`Copied ${brokenTracks.length} broken file names`);
  };

  const copySingleName = (name: string) => {
    navigator.clipboard.writeText(name);
    toast.success(`Copied: ${name}`);
  };

  const handleClear = () => {
    clearBrokenTracks();
    toast.success("Broken files list cleared");
  };

  const saveToFile = async () => {
    const api = window.electronAPI;
    if (api && sourceFolder && brokenTracks.length > 0) {
      const result = await api.saveBrokenList(sourceFolder, brokenTracks);
      if (result.ok) {
        toast.success(`Saved to: ${result.filePath}`);
      } else {
        toast.error("Failed to save");
      }
    } else if (!sourceFolder) {
      toast.error("No source folder selected");
    }
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-auto md:w-96 z-40">
      <div className={cn(
        "bg-card border border-border rounded-lg shadow-lg overflow-hidden transition-all",
        isExpanded ? "max-h-96" : "max-h-12"
      )}>
        <div 
          className="flex items-center justify-between p-3 bg-destructive/10 cursor-pointer hover:bg-destructive/20 transition-colors"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium">
              Broken Files ({brokenTracks.length})
            </span>
          </div>
          <div className="flex items-center gap-2">
            {isExpanded && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    copyAllNames();
                  }}
                >
                  <Copy className="w-3 h-3 mr-1" />
                  Copy All
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    saveToFile();
                  }}
                >
                  <Save className="w-3 h-3 mr-1" />
                  Save
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs text-red-500 hover:text-red-600"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClear();
                  }}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Clear
                </Button>
              </>
            )}
            <button className="text-muted-foreground hover:text-foreground">
              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isExpanded && (
          <ScrollArea className="h-64 p-2">
            {brokenTracks.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm p-4">
                No broken files
              </div>
            ) : (
              <div className="space-y-1">
                {brokenTracks.map((track, idx) => (
                  <div
                    key={track.id || idx}  // ИЗМЕНИЛ key на track.id
                    className="flex items-center justify-between gap-2 p-2 rounded hover:bg-muted/50 group"
                  >
                    <span className="text-xs text-muted-foreground truncate flex-1" title={track.name}>
                      {track.name}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => copySingleName(track.name)}
                    >
                      <Copy className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        )}
      </div>
    </div>
  );
}