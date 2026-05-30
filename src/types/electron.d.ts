export interface AudioFileEntry {
  path: string;
  name: string;
  size: number;
  extension: string;
  cover?: string;
}

export interface TrackTags {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  cover?: {
    mime: string;
    type: string;
    description: string;
    imageBuffer: string;
  } | null;
}

export interface ElectronAPI {
  // Folder dialogs
  selectFolder: () => Promise<string | null>;
  selectFolderWithPreview: () => Promise<string | null>;
  selectFiles: () => Promise<AudioFileEntry[] | null>;
  
  // File operations
  readFile: (path: string) => Promise<ArrayBuffer>;
  readFileAsBuffer: (path: string) => Promise<Buffer>;
  getFileUrl: (path: string) => Promise<string | null>;
  getFileInfo: (path: string) => Promise<{
    size: number;
    isFile: boolean;
    birthtime: Date;
    mtime: Date;
  }>;
  renameFile: (oldPath: string, newName: string) => Promise<{ ok: boolean; newPath?: string; error?: string }>;
  
  // Tag operations
  readTags: (filePath: string) => Promise<TrackTags | null>;
  updateTitle: (filePath: string, newTitle: string) => Promise<{ ok: boolean; error?: string }>;
  updateCover: (filePath: string, coverBase64: string) => Promise<{ ok: boolean; error?: string }>;
  updateCoverOnAccept: (targetFolder: string, fileName: string, coverBase64: string) => Promise<{ ok: boolean; error?: string }>;
  
  // Track actions
  acceptTrack: (srcPath: string, targetFolder: string, mode: "copy" | "move") => Promise<{ ok: boolean; skipped?: boolean; error?: string }>;
  rejectTrack: (srcPath: string, mode: "none" | "move", rejectedFolder?: string) => Promise<{ ok: boolean; error?: string }>;
  
  // Folder scanning
  scanFolder: (folderPath: string) => Promise<AudioFileEntry[]>;
  checkFile: (filePath: string) => Promise<boolean>;
  getDroppedPath: (filePath: string) => Promise<string | null>;
  getDesktopPath: () => Promise<string>;
  
  // Broken files
  saveBrokenList: (folderPath: string, brokenFiles: Array<{ id: string; name: string; path: string }>) => Promise<{ ok: boolean; filePath?: string; error?: string }>;
  
  // Path utilities
  isPathProcessed: (path: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};