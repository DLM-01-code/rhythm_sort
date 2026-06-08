import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Save, RefreshCw, Tag, ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface TagData {
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  trackNumber: string;
  comment: string;
  albumArtist: string;
  composer: string;
  discNumber: string;
  bpm: string;
  initialKey: string;
}

interface TagsEditorProps {
  filePath: string;
  trackName: string;
  onTagsUpdated?: (tags: Partial<TagData>) => void;
}

const EMPTY_TAGS: TagData = {
  title: "", artist: "", album: "", year: "", genre: "",
  trackNumber: "", comment: "", albumArtist: "", composer: "",
  discNumber: "", bpm: "", initialKey: "",
};

const FIELD_LABELS: Record<keyof TagData, string> = {
  title: "Title",
  artist: "Artist",
  album: "Album",
  year: "Year",
  genre: "Genre",
  trackNumber: "Track №",
  comment: "Comment",
  albumArtist: "Album Artist",
  composer: "Composer",
  discNumber: "Disc №",
  bpm: "BPM",
  initialKey: "Key",
};

// Поля показываемые в основном ряду
const PRIMARY_FIELDS: (keyof TagData)[] = ["title", "artist", "album", "year", "genre", "bpm", "initialKey"];
// Поля в расширенном блоке
const EXTRA_FIELDS: (keyof TagData)[] = ["trackNumber", "albumArtist", "composer", "discNumber", "comment"];

export function TagsEditor({ filePath, trackName, onTagsUpdated }: TagsEditorProps) {
  const [tags, setTags] = useState<TagData>(EMPTY_TAGS);
  const [original, setOriginal] = useState<TagData>(EMPTY_TAGS);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [showExtra, setShowExtra] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  const loadTags = useCallback(async () => {
    if (!filePath) return;
    const api = window.electronAPI;
    if (!api?.readFullTags) return;
    setIsLoading(true);
    try {
      const result = await api.readFullTags(filePath);
      if (result) {
        const loaded = { ...EMPTY_TAGS, ...result };
        setTags(loaded);
        setOriginal(loaded);
        setIsDirty(false);
      } else {
        setTags(EMPTY_TAGS);
        setOriginal(EMPTY_TAGS);
      }
    } catch (err) {
      console.error("Failed to load tags:", err);
    } finally {
      setIsLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    loadTags();
  }, [loadTags]);

  const handleChange = (field: keyof TagData, value: string) => {
    setTags(prev => ({ ...prev, [field]: value }));
    setIsDirty(true);
  };

  const handleSave = async () => {
    const api = window.electronAPI;
    if (!api?.writeFullTags) {
      toast.error("Tag writing not supported");
      return;
    }
    setIsSaving(true);
    try {
      const result = await api.writeFullTags(filePath, tags);
      if (result.ok) {
        setOriginal(tags);
        setIsDirty(false);
        toast.success("Tags saved");
        onTagsUpdated?.(tags);
      } else {
        toast.error("Failed to save tags: " + (result.error || "Unknown error"));
      }
    } catch (err) {
      toast.error("Error saving tags");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAnalyze = async (type: "bpm" | "key" | "both") => {
    const api = window.electronAPI;
    if (!api) return;
    setIsAnalyzing(true);
    try {
      if (type === "bpm" || type === "both") {
        toast.info("Analyzing BPM...");
        const r = await api.analyzeBpm?.(filePath);
        if (r?.ok) {
          setTags(prev => ({ ...prev, bpm: r.bpm }));
          setIsDirty(true);
          toast.success(`BPM: ${r.bpm}`);
        } else {
          toast.error("BPM analysis failed: " + (r?.error || "error"));
        }
      }
      if (type === "key" || type === "both") {
        toast.info("Analyzing key...");
        const r = await api.analyzeKey?.(filePath);
        if (r?.ok) {
          setTags(prev => ({ ...prev, initialKey: r.key }));
          setIsDirty(true);
          toast.success(`Key: ${r.key}`);
        } else {
          toast.error("Key analysis failed: " + (r?.error || "error"));
        }
      }
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDiscard = () => {
    setTags(original);
    setIsDirty(false);
  };

  return (
    <div className="border-t border-border bg-card/40 backdrop-blur-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border/50">
        <div className="flex items-center gap-2">
          <Tag className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Tags</span>
          {isLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
          {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-primary" title="Unsaved changes" />}
        </div>
        <div className="flex items-center gap-1">
          {/* Analyze buttons */}
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs gap-1"
            onClick={() => handleAnalyze("bpm")}
            disabled={isAnalyzing || isLoading}
            title="Analyze BPM"
          >
            {isAnalyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
            BPM
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => handleAnalyze("key")}
            disabled={isAnalyzing || isLoading}
            title="Analyze Key"
          >
            Key
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 px-2 text-xs"
            onClick={() => handleAnalyze("both")}
            disabled={isAnalyzing || isLoading}
            title="Analyze both BPM and Key"
          >
            Both
          </Button>
          <div className="w-px h-4 bg-border mx-1" />
          {isDirty && (
            <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={handleDiscard}>
              Discard
            </Button>
          )}
          <Button
            size="sm"
            variant={isDirty ? "default" : "ghost"}
            className="h-6 px-2 text-xs gap-1"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
          >
            {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
            Save
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-6 w-6 p-0"
            onClick={loadTags}
            disabled={isLoading}
            title="Reload tags"
          >
            <RefreshCw className="w-3 h-3" />
          </Button>
        </div>
      </div>

      {/* Primary fields */}
      <div className="px-4 py-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {PRIMARY_FIELDS.map(field => (
            <div key={field} className="space-y-0.5">
              <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                {FIELD_LABELS[field]}
              </Label>
              <Input
                value={tags[field]}
                onChange={e => handleChange(field, e.target.value)}
                className="h-7 text-xs bg-background/60 border-border/60 focus:border-primary"
                placeholder={`—`}
                disabled={isLoading || isSaving}
              />
            </div>
          ))}
        </div>

        {/* Extra fields toggle */}
        <button
          className="mt-2 flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => setShowExtra(!showExtra)}
        >
          {showExtra ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {showExtra ? "Hide extra fields" : "Show more fields"}
        </button>

        {showExtra && (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-2">
            {EXTRA_FIELDS.map(field => (
              <div key={field} className="space-y-0.5">
                <Label className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  {FIELD_LABELS[field]}
                </Label>
                <Input
                  value={tags[field]}
                  onChange={e => handleChange(field, e.target.value)}
                  className="h-7 text-xs bg-background/60 border-border/60 focus:border-primary"
                  placeholder="—"
                  disabled={isLoading || isSaving}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
