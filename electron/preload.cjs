const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Folder selection
  selectFolder: () => ipcRenderer.invoke('dialog:selectFolder'),
  selectFolderWithPreview: (startPath, mode) => ipcRenderer.invoke('dialog:selectFolderWithPreview', startPath, mode),
  selectFiles: () => ipcRenderer.invoke('dialog:selectFiles'),

  // File system operations
  scanFolder: (folder) => ipcRenderer.invoke('fs:scanFolder', folder),
  readFileAsBuffer: (path) => ipcRenderer.invoke('fs:readFile', path),
  getFileUrl: (path) => ipcRenderer.invoke('fs:getFileUrl', path),
  checkFile: (path) => ipcRenderer.invoke('fs:checkFile', path),
  checkFolderExists: (folderPath) => ipcRenderer.invoke('fs:checkFolderExists', folderPath),
  getDroppedPath: (filePath) => ipcRenderer.invoke('fs:getDroppedPath', filePath),
  getDesktopPath: () => ipcRenderer.invoke('fs:getDesktopPath'),

  // File rename operation
  renameFile: (oldPath, newNameWithoutExt) => ipcRenderer.invoke('fs:renameFile', oldPath, newNameWithoutExt),

  // ID3 Tag operations
  readTags: (filePath) => ipcRenderer.invoke('fs:readTags', filePath),
  updateTitle: (filePath, newTitle) => ipcRenderer.invoke('fs:updateTitle', filePath, newTitle),
  updateCover: (filePath, coverBase64) => ipcRenderer.invoke('fs:updateCover', filePath, coverBase64),
  updateCoverOnAccept: (targetFolder, fileName, coverBase64) => ipcRenderer.invoke('fs:updateCoverOnAccept', targetFolder, fileName, coverBase64),

  // Полные теги
  readFullTags: (filePath) => ipcRenderer.invoke('fs:readFullTags', filePath),
  writeFullTags: (filePath, tagData) => ipcRenderer.invoke('fs:writeFullTags', filePath, tagData),

  // BPM / Key анализ
  analyzeBpm: (filePath) => ipcRenderer.invoke('fs:analyzeBpm', filePath),
  analyzeKey: (filePath) => ipcRenderer.invoke('fs:analyzeKey', filePath),

  // Пакетное переименование
  batchRename: (filePath, template) => ipcRenderer.invoke('fs:batchRename', filePath, template),

  // Broken files
  saveBrokenList: (folderPath, brokenFiles) => ipcRenderer.invoke('fs:saveBrokenList', folderPath, brokenFiles),

  // Track operations
  acceptTrack: (src, targetFolder, mode) => ipcRenderer.invoke('fs:accept', src, targetFolder, mode),
  rejectTrack: (src, mode, rejectedFolder) => ipcRenderer.invoke('fs:reject', src, mode, rejectedFolder),
});