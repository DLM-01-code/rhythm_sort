import { useSettings, type CoverApplyMode, type VizMode, type BpmAnalyzeMode } from "@/store/settingsStore";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useState } from "react";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ✅ FIX 4: общий класс для всех SelectContent — непрозрачный фон
const SELECT_CONTENT_CLASS = "bg-card border-border opacity-100 z-[9999]";

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const {
    theme,
    acceptMode,
    rejectMode,
    seekStep,
    autoPlayNext,
    autoPlayAfterLoad,
    coverApplyMode,
    vizEnabled,
    vizMode,
    vizSensitivity,
    performanceMode,
    showTagsPanel,
    continueSession,
    analyzeBpm,
    analyzeKey,
    renameTemplate,
    brokenStopMode,
    maxBrokenBeforeStop,
    keys,
    set,
    setKeys,
  } = useSettings();

  const [waitingForKey, setWaitingForKey] = useState<keyof typeof keys | null>(null);

  const startKeyChange = (keyName: keyof typeof keys) => {
    setWaitingForKey(keyName);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (waitingForKey) {
      e.preventDefault();
      e.stopPropagation();
      const code = e.code;
      if (code) {
        setKeys({ [waitingForKey]: code });
      }
      setWaitingForKey(null);
    }
  };

  const getKeyDisplay = (keyCode: string, keyName: keyof typeof keys): string => {
    if (waitingForKey === keyName) {
      return "Press any key...";
    }
    if (keyCode === "ArrowRight") return "→";
    if (keyCode === "ArrowLeft") return "←";
    if (keyCode === "ArrowUp") return "↑";
    if (keyCode === "ArrowDown") return "↓";
    if (keyCode === "Space") return "␣";
    if (keyCode === "KeyW") return "W";
    if (keyCode === "KeyS") return "S";
    if (keyCode === "KeyA") return "A";
    if (keyCode === "KeyD") return "D";
    return keyCode.replace("Key", "");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-card" onKeyDown={handleKeyDown}>
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure Sortify to your liking
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="general" className="mt-4">
          <TabsList className="grid w-full grid-cols-5 bg-muted">
            <TabsTrigger value="general" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              General
            </TabsTrigger>
            <TabsTrigger value="audio" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Audio
            </TabsTrigger>
            <TabsTrigger value="metadata" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Metadata
            </TabsTrigger>
            <TabsTrigger value="visualizer" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Visualizer
            </TabsTrigger>
            <TabsTrigger value="hotkeys" className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              Hotkeys
            </TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="space-y-4 mt-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Appearance</CardTitle>
                <CardDescription>Theme and display settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground">Dark Mode</Label>
                  <Switch
                    checked={theme === "dark"}
                    onCheckedChange={(checked) => set("theme", checked ? "dark" : "light")}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>File Operations</CardTitle>
                <CardDescription>How tracks are handled</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground">Accept Mode</Label>
                  <Select value={acceptMode} onValueChange={(v) => set("acceptMode", v as any)}>
                    <SelectTrigger className="w-32 bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    {/* ✅ FIX 4 */}
                    <SelectContent className={SELECT_CONTENT_CLASS}>
                      <SelectItem value="copy">Copy</SelectItem>
                      <SelectItem value="move">Move</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-foreground">Reject Mode</Label>
                  <span className="text-sm text-muted-foreground">Skip Only</span>
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-foreground">Auto-play next track</Label>
                  <Switch
                    checked={autoPlayNext}
                    onCheckedChange={(checked) => set("autoPlayNext", checked)}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-foreground">Auto-play after folder load</Label>
                  <Switch
                    checked={autoPlayAfterLoad}
                    onCheckedChange={(checked) => set("autoPlayAfterLoad", checked)}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <Label className="text-foreground">Auto-apply cover</Label>
                  <Select value={coverApplyMode} onValueChange={(v) => set("coverApplyMode", v as CoverApplyMode)}>
                    <SelectTrigger className="w-40 bg-background border-border">
                      <SelectValue />
                    </SelectTrigger>
                    {/* ✅ FIX 4 */}
                    <SelectContent className={SELECT_CONTENT_CLASS}>
                      <SelectItem value="off">Off</SelectItem>
                      <SelectItem value="onAccept">On Accept</SelectItem>
                      <SelectItem value="onFolderLoad">On Folder Load</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Audio Tab */}
          <TabsContent value="audio" className="space-y-4 mt-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Playback</CardTitle>
                <CardDescription>Audio playback settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-foreground">Seek Step: {seekStep} seconds</Label>
                  <Slider
                    value={[seekStep]}
                    min={5}
                    max={30}
                    step={5}
                    onValueChange={([value]) => set("seekStep", value)}
                    className="[&_[role=slider]]:bg-primary"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Broken File Handling</CardTitle>
                <CardDescription>What to do when broken files are encountered</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-foreground">On broken file</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {brokenStopMode === "stop" ? "Stop playback after several broken files in a row" : "Skip one by one, never stop automatically"}
                    </p>
                  </div>
                  <Switch
                    checked={brokenStopMode === "stop"}
                    onCheckedChange={(v) => set("brokenStopMode", v ? "stop" : "one")}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
                {brokenStopMode === "stop" && (
                  <div className="space-y-2">
                    <Label className="text-foreground">Stop after {maxBrokenBeforeStop} broken in a row</Label>
                    <Slider
                      value={[maxBrokenBeforeStop]}
                      min={1} max={10} step={1}
                      onValueChange={([v]) => set("maxBrokenBeforeStop", v)}
                      className="[&_[role=slider]]:bg-primary"
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Metadata Tab */}
          <TabsContent value="metadata" className="space-y-4 mt-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Tags Panel</CardTitle>
                <CardDescription>Display and edit ID3 tags under the player</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-foreground">Show Tags Panel</Label>
                  <Switch
                    checked={showTagsPanel}
                    onCheckedChange={(checked) => set("showTagsPanel", checked)}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label className="text-foreground">Continue Session on Start</Label>
                  <Switch
                    checked={continueSession}
                    onCheckedChange={(checked) => set("continueSession", checked)}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Auto-Analysis on Accept</CardTitle>
                <CardDescription>Analyze and write BPM / Key when accepting a track</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-foreground">Analyze BPM on Accept</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Detects tempo and writes it to the file tag</p>
                  </div>
                  <Switch
                    checked={analyzeBpm}
                    onCheckedChange={(checked) => set("analyzeBpm", checked)}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-foreground">Analyze Key on Accept</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Detects musical key and writes it to the file tag</p>
                  </div>
                  <Switch
                    checked={analyzeKey}
                    onCheckedChange={(checked) => set("analyzeKey", checked)}
                    className="data-[state=checked]:bg-primary"
                  />
                </div>
                {(analyzeBpm || analyzeKey) && (
                  <p className="text-xs text-yellow-500/80 bg-yellow-500/10 rounded p-2">
                    ⚠️ Analysis runs after each Accept — may add 1–3 seconds per track
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Batch Rename Template</CardTitle>
                <CardDescription>Template for renaming files via Tags Panel</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <input
                  type="text"
                  value={renameTemplate}
                  onChange={(e) => set("renameTemplate", e.target.value)}
                  className="w-full h-9 px-3 rounded-md border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="{BPM} - {Key} - {Artist} - {Title}"
                />
                <p className="text-xs text-muted-foreground">
                  Available: {"{Title}"} {"{Artist}"} {"{Album}"} {"{Year}"} {"{Genre}"} {"{BPM}"} {"{Key}"} {"{TrackNumber}"}
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Visualizer Tab */}
          <TabsContent value="visualizer" className="space-y-4 mt-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Visualizer</CardTitle>
                <CardDescription>Audio visualization settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-muted/30 rounded-lg">
                  <div>
                    <Label htmlFor="viz-enabled" className="text-base font-semibold text-foreground">
                      Enable Visualizer
                    </Label>
                    <p className="text-sm text-muted-foreground mt-1">
                      Show/hide audio visualization on player screen
                    </p>
                  </div>
                  <Switch
                    id="viz-enabled"
                    checked={vizEnabled}
                    onCheckedChange={(checked) => set("vizEnabled", checked)}
                    className="data-[state=checked]:bg-primary scale-110"
                  />
                </div>

                {vizEnabled && (
                  <div className="pt-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-foreground">Visualization Mode</Label>
                      <Select value={vizMode} onValueChange={(v) => set("vizMode", v as VizMode)}>
                        <SelectTrigger className="w-48 bg-background border-border">
                          <SelectValue />
                        </SelectTrigger>
                        {/* ✅ FIX 4 */}
                        <SelectContent className={SELECT_CONTENT_CLASS}>
                          <SelectItem value="dual_waveform">🎛️ Dual Waveform</SelectItem>
                          <SelectItem value="rms_meter">📏 RMS Meter</SelectItem>
                          <SelectItem value="aurora">🌌 Aurora</SelectItem>
                          <SelectItem value="vu_meter">💡 VU Meter</SelectItem>
                          <SelectItem value="lissajous">🎯 Lissajous</SelectItem>
                          <SelectItem value="wave">🌊 Wave</SelectItem>
                          <SelectItem value="particle_flow">✨ Particle Flow</SelectItem>
                          <SelectItem value="dna_helix">🧬 DNA Helix</SelectItem>
                          <SelectItem value="ink_drop">🖋️ Ink Drop</SelectItem>
                          <SelectItem value="city_lights">🌃 City Lights</SelectItem>
                          <SelectItem value="neon_ring">💠 Neon Ring</SelectItem>
                          <SelectItem value="mirror_bars">🪞 Mirror Bars</SelectItem>
                          <SelectItem value="plasma">🔮 Plasma</SelectItem>
                          <SelectItem value="oscilloscope">📟 Oscilloscope</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-foreground">Sensitivity: {vizSensitivity.toFixed(1)}</Label>
                      <Slider
                        value={[vizSensitivity]}
                        min={0.5}
                        max={2}
                        step={0.1}
                        onValueChange={([value]) => set("vizSensitivity", value)}
                        className="[&_[role=slider]]:bg-primary"
                      />
                      <p className="text-xs text-muted-foreground">
                        Controls the intensity/height of the visualization
                      </p>
                    </div>

                    <div className="flex items-center justify-between">
                      <Label className="text-foreground">Performance Mode</Label>
                      <Switch
                        checked={performanceMode}
                        onCheckedChange={(checked) => set("performanceMode", checked)}
                        className="data-[state=checked]:bg-primary"
                      />
                      <p className="text-xs text-muted-foreground ml-2">
                        Reduces FPS for better performance
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Hotkeys Tab */}
          <TabsContent value="hotkeys" className="space-y-4 mt-4">
            <Card className="bg-card border-border">
              <CardHeader>
                <CardTitle>Keyboard Shortcuts</CardTitle>
                <CardDescription>Customize your hotkeys</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Accept Track</Label>
                    <div
                      className={`p-2 border rounded-md text-center font-mono text-sm cursor-pointer transition-all ${
                        waitingForKey === "accept"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 hover:bg-muted border-border text-foreground"
                      }`}
                      onClick={() => startKeyChange("accept")}
                    >
                      {getKeyDisplay(keys.accept, "accept")}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Reject/Skip Track</Label>
                    <div
                      className={`p-2 border rounded-md text-center font-mono text-sm cursor-pointer transition-all ${
                        waitingForKey === "reject"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 hover:bg-muted border-border text-foreground"
                      }`}
                      onClick={() => startKeyChange("reject")}
                    >
                      {getKeyDisplay(keys.reject, "reject")}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Play/Pause</Label>
                    <div
                      className={`p-2 border rounded-md text-center font-mono text-sm cursor-pointer transition-all ${
                        waitingForKey === "playPause"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 hover:bg-muted border-border text-foreground"
                      }`}
                      onClick={() => startKeyChange("playPause")}
                    >
                      {getKeyDisplay(keys.playPause, "playPause")}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Previous Track</Label>
                    <div
                      className={`p-2 border rounded-md text-center font-mono text-sm cursor-pointer transition-all ${
                        waitingForKey === "prevTrack"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 hover:bg-muted border-border text-foreground"
                      }`}
                      onClick={() => startKeyChange("prevTrack")}
                    >
                      {getKeyDisplay(keys.prevTrack, "prevTrack")}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Next Track</Label>
                    <div
                      className={`p-2 border rounded-md text-center font-mono text-sm cursor-pointer transition-all ${
                        waitingForKey === "nextTrack"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 hover:bg-muted border-border text-foreground"
                      }`}
                      onClick={() => startKeyChange("nextTrack")}
                    >
                      {getKeyDisplay(keys.nextTrack, "nextTrack")}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Volume Up</Label>
                    <div
                      className={`p-2 border rounded-md text-center font-mono text-sm cursor-pointer transition-all ${
                        waitingForKey === "volumeUp"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 hover:bg-muted border-border text-foreground"
                      }`}
                      onClick={() => startKeyChange("volumeUp")}
                    >
                      {getKeyDisplay(keys.volumeUp, "volumeUp")}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Volume Down</Label>
                    <div
                      className={`p-2 border rounded-md text-center font-mono text-sm cursor-pointer transition-all ${
                        waitingForKey === "volumeDown"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 hover:bg-muted border-border text-foreground"
                      }`}
                      onClick={() => startKeyChange("volumeDown")}
                    >
                      {getKeyDisplay(keys.volumeDown, "volumeDown")}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Seek Backward</Label>
                    <div
                      className={`p-2 border rounded-md text-center font-mono text-sm cursor-pointer transition-all ${
                        waitingForKey === "seekBack"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 hover:bg-muted border-border text-foreground"
                      }`}
                      onClick={() => startKeyChange("seekBack")}
                    >
                      {getKeyDisplay(keys.seekBack, "seekBack")}
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Seek Forward</Label>
                    <div
                      className={`p-2 border rounded-md text-center font-mono text-sm cursor-pointer transition-all ${
                        waitingForKey === "seekForward"
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-muted/50 hover:bg-muted border-border text-foreground"
                      }`}
                      onClick={() => startKeyChange("seekForward")}
                    >
                      {getKeyDisplay(keys.seekForward, "seekForward")}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground mt-4">
                  Click on any key box and press a key to change its binding.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
