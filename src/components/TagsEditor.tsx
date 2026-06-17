import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, Music2, Zap } from "lucide-react";
import { toast } from "sonner";
import { useSettings } from "@/store/settingsStore";
import { usePlayer } from "@/store/playerStore";

interface TagsEditorProps {
  filePath: string;
  trackName: string;
}

const TAG_FIELDS = [
  { key: "title",       label: "Title" },
  { key: "artist",      label: "Artist" },
  { key: "album",       label: "Album" },
  { key: "year",        label: "Year" },
  { key: "genre",       label: "Genre" },
  { key: "trackNumber", label: "Track #" },
  { key: "bpm",         label: "BPM" },
  { key: "key",         label: "Key" },
  { key: "composer",    label: "Composer" },
  { key: "comment",     label: "Comment" },
] as const;

type TagKey = typeof TAG_FIELDS[number]["key"];
type Tags = Partial<Record<TagKey, string>>;

export function TagsEditor({ filePath, trackName }: TagsEditorProps) {
  const analyzeMode = useSettings((s) => s.bpmAnalyzeMode);
  const tracks      = usePlayer((s) => s.tracks);
  const currentIdx  = usePlayer((s) => s.currentIndex);
  const trackId     = tracks[currentIdx]?.id || "";

  const [tags, setTags]           = useState<Tags>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isSaving, setIsSaving]   = useState(false);
  const [isDirty, setIsDirty]     = useState(false);

  useEffect(() => {
    if (!filePath) return;
    setIsDirty(false);
    loadTags();
  }, [filePath]);

  const loadTags = async () => {
    const api = window.electronAPI;
    if (!api) return;
    setIsLoading(true);
    try {
      const t = await api.readTags(filePath);
      if (t) {
        setTags({
          title:       (t as any).title       || "",
          artist:      (t as any).artist      || "",
          album:       (t as any).album       || "",
          year:        (t as any).year        || "",
          genre:       (t as any).genre       || "",
          trackNumber: (t as any).trackNumber || "",
          bpm:         (t as any).bpm         || "",
          key:         (t as any).key         || "",
          composer:    (t as any).composer    || "",
          comment:     (t as any).comment     || "",
        });
      }
    } catch (e) {
      console.error("Failed to load tags:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (key: TagKey, value: string) => {
    setTags(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    const api = window.electronAPI;
    if (!api) return;
    setIsSaving(true);
    try {
      if ((api as any).writeFullTags) {
        await (api as any).writeFullTags(filePath, tags);
      } else {
        await api.updateTitle(filePath, tags.title || "");
      }
      setIsDirty(false);
      toast.success("Tags saved");
    } catch (e) {
      toast.error("Failed to save tags");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnalyze = async () => {
    const api = window.electronAPI as any;
    if (!api) return;
    setIsAnalyzing(true);
    try {
      const newTags = { ...tags };
      if (api.analyzeBpm) {
        const r = await api.analyzeBpm(filePath);
        if (r?.bpm) newTags.bpm = String(r.bpm);
      }
      if (api.analyzeKey) {
        const r = await api.analyzeKey(filePath);
        if (r?.key) newTags.key = r.key;
      }
      setTags(newTags);
      setIsDirty(true);
      const parts = [];
      if (newTags.bpm) parts.push("BPM " + newTags.bpm);
      if (newTags.key) parts.push("Key " + newTags.key);
      toast.success(parts.length ? "Analyzed: " + parts.join(" | ") : "Analysis complete");
    } catch (e) {
      toast.error("Analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-4 text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin mr-2" />
        <span className="text-xs">Loading tags...</span>
      </div>
    );
  }

  return (
    <div className="border-t border-border bg-card/40 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Music2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Tags</span>
          {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Unsaved changes" />}
        </div>
        <div className="flex items-center gap-2">
          {analyzeMode !== "off" && (
            <Button size="sm" variant="outline" onClick={handleAnalyze} disabled={isAnalyzing} className="h-6 text-xs gap-1 px-2">
              {isAnalyzing ? <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing...</> : <><Zap className="w-3 h-3" /> Analyze</>}
            </Button>
          )}
          {isDirty && (
            <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-6 text-xs px-2">
              {isSaving ? "Saving..." : "Save"}
            </Button>
          )}
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-1.5 p-3">
        {TAG_FIELDS.map(({ key, label }) => (
          <div key={key} className="flex flex-col gap-0.5">
            <label className="text-[10px] text-muted-foreground px-1">{label}</label>
            <input
              type="text"
              value={tags[key] || ""}
              onChange={(e) => handleChange(key, e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
              className="h-7 text-xs bg-background border border-border rounded px-2 focus:outline-none focus:ring-1 focus:ring-primary text-foreground"
              placeholder="—"
            />
          </div>
        ))}
      </div>
    </div>
  );
}
