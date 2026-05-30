import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { Toolbar } from "@/components/Toolbar";
import { PlayerView } from "@/components/PlayerView";
import { Queue } from "@/components/Queue";
import { BrokenFiles } from "@/components/BrokenFiles";
import { SettingsDialog } from "@/components/SettingsDialog";
import { SplitPanel } from "@/components/ui/SplitPanel";
import { useSettings } from "@/store/settingsStore";
import { Toaster } from "@/components/ui/sonner";
import { ChevronLeft, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(320);
  const [isResizing, setIsResizing] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const sidebarRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);
  
  const theme = useSettings((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("light", theme === "light");
    root.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;
    
    const delta = startXRef.current - e.clientX;
    const newWidth = startWidthRef.current + delta;
    
    if (newWidth >= 200 && newWidth <= 600) {
      setSidebarWidth(newWidth);
      if (isCollapsed && newWidth > 200) {
        setIsCollapsed(false);
      }
    }
  }, [isResizing, isCollapsed]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  const toggleSidebar = useCallback(() => {
    setIsCollapsed(!isCollapsed);
  }, [isCollapsed]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'ew-resize';
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }
    
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <Toolbar onOpenSettings={() => setSettingsOpen(true)} />
      <div className="flex flex-1 overflow-hidden relative">
        <div className="flex-1 min-w-0">
          <PlayerView />
        </div>
        
        <div
          ref={sidebarRef}
          style={{ 
            width: isCollapsed ? 0 : sidebarWidth,
            transition: isResizing ? 'none' : 'width 0.2s ease'
          }}
          className="relative overflow-hidden border-l border-border"
        >
          {!isCollapsed && <Queue />}
        </div>

        <button
          onClick={toggleSidebar}
          className={cn(
            "fixed top-1/2 -translate-y-1/2 z-50 bg-card border border-border rounded-full p-1.5 hover:bg-accent transition-all shadow-md",
            isCollapsed ? "right-0 translate-x-1/2" : "-ml-3"
          )}
          style={isCollapsed ? { right: 0 } : {}}
          title={isCollapsed ? "Show queue" : "Hide queue"}
        >
          {isCollapsed ? (
            <ChevronLeft className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        {!isCollapsed && (
          <div
            className="fixed right-[320px] top-1/2 -translate-y-1/2 w-1 h-16 bg-border hover:bg-primary/50 cursor-ew-resize rounded transition-all z-40"
            style={{ right: sidebarWidth }}
            onMouseDown={handleMouseDown}
            title="Change width"
          />
        )}
      </div>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <Toaster theme={theme === "light" ? "light" : "dark"} richColors position="top-center" />
      <BrokenFiles />
      <SplitPanel />
    </div>
  );
}

function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}