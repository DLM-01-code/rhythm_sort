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

export interface FullTrackTags {
  title?: string;
  artist?: string;
  album?: string;
  year?: string;
  genre?: string;
  trackNumber?: string;
  discNumber?: string;
  albumArtist?: string;
  composer?: string;
  comment?: string;
  bpm?: string;
  key?: string;
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
  selectFolderWithPreview: (startPath?: string, mode?: 'source' | 'target') => Promise<string | null>;
  selectFiles: () => Promise<AudioFileEntry[] | null>;

  // File operations
  readFile: (path: string) => Promise<ArrayBuffer>;
  readFileAsBuffer: (path: string) => Promise<ArrayBuffer>;
  readAudioForPlayback: (path: string) => Promise<{ buffer: ArrayBuffer; ext: string }>;
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

  // Полные теги
  readFullTags: (filePath: string) => Promise<FullTrackTags | null>;
  writeFullTags: (filePath: string, tagData: Partial<FullTrackTags>) => Promise<{ ok: boolean; error?: string }>;

  // BPM / Key анализ
  analyzeBpm: (filePath: string) => Promise<{ bpm: number | null }>;
  analyzeKey: (filePath: string) => Promise<{ key: string | null }>;

  // Пакетное переименование по шаблону
  batchRename: (filePath: string, template: string) => Promise<{ ok: boolean; newPath?: string; error?: string }>;

  // Track actions
  acceptTrack: (srcPath: string, targetFolder: string, mode: "copy" | "move") => Promise<{ ok: boolean; skipped?: boolean; error?: string }>;
  rejectTrack: (srcPath: string, mode: "none" | "move", rejectedFolder?: string) => Promise<{ ok: boolean; error?: string }>;

  // Folder scanning
  scanFolder: (folderPath: string) => Promise<AudioFileEntry[]>;
  checkFile: (filePath: string) => Promise<boolean>;
  checkFolderExists: (folderPath: string) => Promise<boolean>;
  getDroppedPath: (filePath: string) => Promise<string | null>;
  getDesktopPath: () => Promise<string>;

  // Broken files
  saveBrokenList: (folderPath: string, brokenFiles: Array<{ id: string; name: string; path: string }>) => Promise<{ ok: boolean; filePath?: string; error?: string }>;

  // Trash/delete (folder browser)
  trashFolder: (folderPath: string) => Promise<{ ok: boolean; error?: string }>;
  deleteFolder: (folderPath: string) => Promise<{ ok: boolean; error?: string }>;

  // Path utilities
  isPathProcessed: (path: string) => Promise<boolean>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};