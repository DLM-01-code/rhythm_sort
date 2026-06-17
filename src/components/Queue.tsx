import { useState, useCallback, useMemo, memo, useEffect, useRef } from "react";
import { usePlayer } from "@/store/playerStore";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle, AlertCircle, Music, Headphones, Image as ImageIcon, MoveRight, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const VIDEO_EXTS = new Set(['mp4','mkv','avi','mov','wmv','flv','webm','m4v','3gp']);
function isVideoFile(ext: string) { return VIDEO_EXTS.has(ext.toLowerCase()); }

const QueueItem = memo(({ track, index, isCurrent, isPlaying, onTrackClick, itemRef }: {
  track: any; index: number; isCurrent: boolean; isPlaying: boolean;
  onTrackClick: (i: number) => void;
  itemRef?: (el: HTMLDivElement | null) => void;
}) => {
  const isMoved = track.status === "moved";
  const isClickable = track.status !== "error" && !isMoved;

  const getIcon = () => {
    if (isMoved)                     return <MoveRight className="w-3 h-3 md:w-4 md:h-4 text-orange-400 flex-shrink-0" />;
    if (track.status === "accepted") return <CheckCircle className="w-3 h-3 md:w-4 md:h-4 text-green-500 flex-shrink-0" />;
    if (track.status === "rejected") return <XCircle className="w-3 h-3 md:w-4 md:h-4 text-red-500 flex-shrink-0" />;
    if (track.status === "error")    return <AlertCircle className="w-3 h-3 md:w-4 md:h-4 text-gray-500 flex-shrink-0" />;
    if (track.status === "played")   return <Headphones className="w-3 h-3 md:w-4 md:h-4 text-purple-400 flex-shrink-0" />;
    return <Music className="w-3 h-3 md:w-4 md:h-4 text-blue-400 flex-shrink-0" />;
  };

  const getLabel = () => {
    if (isMoved)                     return "→ Moved";
    if (track.status === "accepted") return "✓ Accepted";
    if (track.status === "rejected") return "✗ Skipped";
    if (track.status === "error")    return "⚠️ Error";
    if (track.status === "played")   return "🎧 Played";
    return "⏳ Pending";
  };

  return (
    <div
      ref={itemRef}
      className={cn(
        "flex items-start gap-2 md:gap-3 px-2 md:px-4 py-2 rounded-lg transition-all duration-200",
        isCurrent && "bg-primary/10 border-l-2 border-primary",
        (track.status === "error" || track.status === "played" || isMoved) && "opacity-60",
        isClickable && !isCurrent && "cursor-pointer hover:bg-accent hover:scale-[1.01]",
        !isClickable && "cursor-not-allowed",
      )}
      onClick={() => isClickable && onTrackClick(index)}
      title={isMoved ? "File was moved — cannot play" : undefined}
    >
      <div className="flex-shrink-0 mt-0.5">{getIcon()}</div>
      <div className="flex-1 min-w-0">
        <p className={cn(
          "text-xs md:text-sm truncate",
          track.status === "error" && "text-muted-foreground line-through",
          track.status === "played" && "text-purple-400",
          isMoved && "text-orange-400/70 line-through",
          isCurrent && isPlaying && "text-primary font-medium"
        )}>
          {track.name}
        </p>
        <p className={cn("text-[10px] md:text-xs mt-0.5", isMoved ? "text-orange-400/60" : "text-muted-foreground")}>
          {getLabel()}
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
  const [searchQuery, setSearchQuery] = useState("");
  const currentItemRef = useRef<HTMLDivElement | null>(null);
  // Ref на нативный скролл-контейнер внутри Radix ScrollArea
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);

  // Находим нативный viewport Radix ScrollArea после mount
  const scrollAreaContainerRef = useCallback((node: HTMLDivElement | null) => {
    if (node) {
      // Radix ScrollArea рендерит div[data-radix-scroll-area-viewport] внутри
      const viewport = node.querySelector('[data-radix-scroll-area-viewport]') as HTMLDivElement | null;
      scrollViewportRef.current = viewport;
    }
  }, []);

  // Авто-скролл к текущему треку при смене currentIndex
  useEffect(() => {
    const item = currentItemRef.current;
    const viewport = scrollViewportRef.current;
    if (!item || !viewport) return;

    // Вычисляем позицию элемента относительно viewport
    const itemTop = item.offsetTop;
    const itemHeight = item.offsetHeight;
    const viewportHeight = viewport.clientHeight;
    const scrollTop = viewport.scrollTop;

    const itemBottom = itemTop + itemHeight;
    const viewportBottom = scrollTop + viewportHeight;

    // Если элемент вне зоны видимости — скроллим
    const margin = 60; // небольшой отступ сверху/снизу
    if (itemTop < scrollTop + margin) {
      viewport.scrollTo({ top: itemTop - margin, behavior: 'smooth' });
    } else if (itemBottom > viewportBottom - margin) {
      viewport.scrollTo({ top: itemBottom - viewportHeight + margin, behavior: 'smooth' });
    }
  }, [currentIndex]);

  const handleTrackClick = useCallback((index: number) => {
    const track = tracks[index];
    if (!track || track.status === "error" || track.status === "moved") return;
    if (currentIndex !== index && tracks[currentIndex]?.status === "pending") markCurrentAsPlayed();
    setIndex(index);
  }, [tracks, currentIndex, markCurrentAsPlayed, setIndex]);

  const applyCoverToAll = useCallback(async () => {
    const current = tracks[currentIndex];
    if (!current?.cover) { toast.error("No cover on current track"); return; }
    setIsApplyingCover(true);
    let ok = 0, fail = 0;
    const audio = tracks.filter(t => t.id !== current.id && t.status !== "error" && !isVideoFile(t.ext));
    for (let i = 0; i < audio.length; i += 50) {
      const results = await Promise.allSettled(audio.slice(i, i+50).map(t => setTrackCover(t.id, current.cover)));
      results.forEach(r => r.status === 'fulfilled' && r.value ? ok++ : fail++);
      if (i + 50 < audio.length) await new Promise(r => setTimeout(r, 10));
    }
    setIsApplyingCover(false);
    toast.success(`Applied cover to ${ok} tracks${fail ? ` (${fail} failed)` : ''}`);
  }, [tracks, currentIndex, setTrackCover]);

  // ✅ Фильтрация по поисковому запросу — сохраняем оригинальные индексы
  const filteredTracks = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return tracks.map((track, idx) => ({ track, idx }));
    return tracks
      .map((track, idx) => ({ track, idx }))
      .filter(({ track }) => track.name.toLowerCase().includes(q));
  }, [tracks, searchQuery]);

  const trackElements = useMemo(() => filteredTracks.map(({ track, idx }) => (
    <QueueItem
      key={track.id}
      track={track}
      index={idx}
      isCurrent={idx === currentIndex}
      isPlaying={isPlaying}
      onTrackClick={handleTrackClick}
      // Передаём ref только текущему треку
      itemRef={idx === currentIndex ? (el) => { currentItemRef.current = el; } : undefined}
    />
  )), [filteredTracks, currentIndex, isPlaying, handleTrackClick]);

  if (tracks.length === 0) {
    return (
      <div className="flex flex-col h-full border-l border-border">
        <div className="p-3 md:p-4 border-b border-border">
          <h3 className="font-semibold text-sm md:text-base">Queue</h3>
          <p className="text-xs md:text-sm text-muted-foreground">0 tracks</p>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-2 px-4">
            <Music className="w-6 h-6 md:w-8 md:h-8 mx-auto opacity-50" />
            <p className="text-sm">No tracks</p>
            <p className="text-xs text-muted-foreground">Select a source folder</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full border-l border-border">
      <div className="p-3 md:p-4 border-b border-border space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm md:text-base">Queue</h3>
            <p className="text-xs md:text-sm text-muted-foreground">
              {searchQuery ? `${filteredTracks.length} / ${tracks.length}` : `${currentIndex + 1} / ${tracks.length}`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Кнопка прокрутки к текущему треку */}
            <Button
              size="sm" variant="ghost"
              onClick={() => {
                const item = currentItemRef.current;
                const viewport = scrollViewportRef.current;
                if (!item || !viewport) return;
                const itemTop = item.offsetTop;
                const itemHeight = item.offsetHeight;
                const viewportHeight = viewport.clientHeight;
                viewport.scrollTo({ top: itemTop - viewportHeight / 2 + itemHeight / 2, behavior: 'smooth' });
              }}
              className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              title="Scroll to current track"
            >
              ⦿
            </Button>
            {tracks[currentIndex]?.cover && (
              <Button size="sm" variant="outline" onClick={applyCoverToAll}
                disabled={isApplyingCover} className="gap-1 text-xs">
                <ImageIcon className="w-3 h-3" />
                {isApplyingCover ? "..." : "Cover All"}
              </Button>
            )}
          </div>
        </div>

        {/* ✅ Поиск по очереди */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search tracks..."
            className="w-full h-8 text-xs bg-background border border-border rounded-md pl-7 pr-7 focus:outline-none focus:ring-1 focus:ring-primary text-foreground placeholder:text-muted-foreground"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <ScrollArea className="flex-1" ref={scrollAreaContainerRef}>
        <div className="p-1 md:p-2 space-y-0.5 md:space-y-1">
          {filteredTracks.length === 0 ? (
            <div className="text-center text-muted-foreground text-xs py-8">
              No tracks match "{searchQuery}"
            </div>
          ) : trackElements}
        </div>
      </ScrollArea>
    </div>
  );
}
