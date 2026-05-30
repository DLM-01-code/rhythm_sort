import { useState, useCallback, useMemo, memo } from "react";
import { usePlayer } from "@/store/playerStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, AlertCircle, Music, Headphones, Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const VIDEO_EXTS = new Set(['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', '3gp']);

function isVideoFile(ext: string): boolean {
  return VIDEO_EXTS.has(ext.toLowerCase());
}

// Мемоизированный компонент отдельного трека
const QueueItem = memo(({ 
  track, 
  index, 
  isCurrent, 
  isPlaying, 
  onTrackClick 
}: { 
  track: any; 
  index: number; 
  isCurrent: boolean; 
  isPlaying: boolean; 
  onTrackClick: (index: number) => void;
}) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "accepted":
        return <CheckCircle className="w-3 h-3 md:w-4 md:h-4 text-green-500 flex-shrink-0" />;
      case "rejected":
        return <XCircle className="w-3 h-3 md:w-4 md:h-4 text-red-500 flex-shrink-0" />;
      case "error":
        return <AlertCircle className="w-3 h-3 md:w-4 md:h-4 text-gray-500 flex-shrink-0" />;
      case "played":
        return <Headphones className="w-3 h-3 md:w-4 md:h-4 text-purple-400 flex-shrink-0" />;
      case "moved":
        return <CheckCircle className="w-3 h-3 md:w-4 md:h-4 text-orange-400 flex-shrink-0" />;
      default:
        return <Music className="w-3 h-3 md:w-4 md:h-4 text-blue-400 flex-shrink-0" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "accepted":
        return "✓ Accepted";
      case "rejected":
        return "✗ Skipped";
      case "error":
        return "⚠️ Error";
      case "played":
        return "🎧 Played";
      case "moved":
        return "→ Moved";
      default:
        return "⏳ Pending";
    }
  };

  const getStatusClass = () => {
    return cn(
      "flex items-start gap-2 md:gap-3 px-2 md:px-4 py-2 rounded-lg cursor-pointer transition-all duration-200",
      isCurrent && "bg-primary/10 border-l-2 border-primary",
      (track.status === "error" || track.status === "played" || track.status === "moved") && "opacity-70",
      !isCurrent && track.status !== "error" && track.status !== "moved" && "hover:bg-accent hover:scale-[1.01]"
    );
  };

  return (
    <div
      className={getStatusClass()}
      onClick={() => onTrackClick(index)}
    >
      <div className="flex-shrink-0 mt-0.5">
        {getStatusIcon(track.status)}
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-xs md:text-sm truncate",
          track.status === "error" && "text-muted-foreground line-through",
          track.status === "moved" && "text-orange-400",
          track.status === "played" && "text-purple-400",
          isCurrent && isPlaying && "text-primary font-medium"
        )}>
          {track.name}
        </p>
        <p className="text-[10px] md:text-xs text-muted-foreground mt-0.5">
          {getStatusText(track.status)}
        </p>
      </div>
      {isCurrent && isPlaying && (
        <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0 mt-1.5" />
      )}
    </div>
  );
});

QueueItem.displayName = 'QueueItem';

export function Queue() {
  const { tracks, currentIndex, setIndex, isPlaying, setTrackCover, markCurrentAsPlayed } = usePlayer();
  const [isApplyingCover, setIsApplyingCover] = useState(false);

  // Мемоизированный обработчик клика
  const handleTrackClick = useCallback((index: number) => {
    if (tracks[index].status === "error" || tracks[index].status === "moved") return;
    
    const currentTrack = tracks[currentIndex];
    if (currentTrack && currentIndex !== index && currentTrack.status === "pending") {
      markCurrentAsPlayed();
    }
    setIndex(index);
  }, [tracks, currentIndex, markCurrentAsPlayed, setIndex]);

  // Применить обложку - оптимизировано с batch updates
  const applyCoverToAll = useCallback(async () => {
    const currentTrack = tracks[currentIndex];
    if (!currentTrack || !currentTrack.cover) {
      toast.error("Current track has no cover to apply");
      return;
    }

    setIsApplyingCover(true);
    let successCount = 0;
    let failCount = 0;
    let skippedCount = 0;

    // Ограничиваем количество одновременных операций
    const BATCH_SIZE = 50;
    const audioTracks = tracks.filter(t => 
      t.id !== currentTrack.id && 
      t.status !== "error" && 
      !isVideoFile(t.ext)
    );

    for (let i = 0; i < audioTracks.length; i += BATCH_SIZE) {
      const batch = audioTracks.slice(i, i + BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map(track => setTrackCover(track.id, currentTrack.cover))
      );
      
      results.forEach(result => {
        if (result.status === 'fulfilled' && result.value) {
          successCount++;
        } else {
          failCount++;
        }
      });

      // Даём браузеру передохнуть между батчами
      if (i + BATCH_SIZE < audioTracks.length) {
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }

    skippedCount = tracks.length - audioTracks.length - 1;
    setIsApplyingCover(false);
    
    let message = `Applied cover to ${successCount} tracks`;
    if (skippedCount > 0) message += ` (skipped ${skippedCount} video files)`;
    if (failCount > 0) message += ` (${failCount} failed)`;
    
    if (successCount > 0) {
      toast.success(message);
    } else if (skippedCount > 0 && successCount === 0) {
      toast.info(`No audio tracks to apply cover (${skippedCount} video files skipped)`);
    } else {
      toast.error("Failed to apply cover to any track");
    }
  }, [tracks, currentIndex, setTrackCover]);

  // Мемоизация списка треков для оптимизации рендера
  const trackElements = useMemo(() => {
    return tracks.map((track, idx) => (
      <QueueItem
        key={track.id}
        track={track}
        index={idx}
        isCurrent={idx === currentIndex}
        isPlaying={isPlaying}
        onTrackClick={handleTrackClick}
      />
    ));
  }, [tracks, currentIndex, isPlaying, handleTrackClick]);

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col h-full border-l border-border">
        <div className="p-3 md:p-4 border-b border-border">
          <h3 className="font-semibold text-sm md:text-base">Queue</h3>
          <p className="text-xs md:text-sm text-muted-foreground">0 tracks</p>
        </div>
        <div className="flex-1 flex items-center justify-center w-full">
          <div className="text-center space-y-2 w-full max-w-[200px] px-4">
            <Music className="w-6 h-6 md:w-8 md:h-8 mx-auto opacity-50" />
            <p className="text-sm">No tracks</p>
            <p className="text-xs text-muted-foreground break-words">
              Select a source folder
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentTrack = tracks[currentIndex];
  const hasCover = currentTrack?.cover;

  return (
    <div className="flex flex-col h-full border-l border-border">
      <div className="p-3 md:p-4 border-b border-border">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm md:text-base">Queue</h3>
            <p className="text-xs md:text-sm text-muted-foreground">{tracks.length} tracks</p>
          </div>
          {hasCover && (
            <Button
              size="sm"
              variant="outline"
              onClick={applyCoverToAll}
              disabled={isApplyingCover}
              className="gap-1 text-xs"
            >
              <ImageIcon className="w-3 h-3" />
              {isApplyingCover ? "Applying..." : "Apply Cover to All"}
            </Button>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-1 md:p-2 space-y-0.5 md:space-y-1">
          {trackElements}
        </div>
      </ScrollArea>
    </div>
  );
}