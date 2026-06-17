const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Folder selection
  selectFolder:            ()                              => ipcRenderer.invoke('dialog:selectFolder'),
  selectFolderWithPreview: (startPath, mode)              => ipcRenderer.invoke('dialog:selectFolderWithPreview', startPath, mode),
  selectFiles:             ()                              => ipcRenderer.invoke('dialog:selectFiles'),

  // File system operations
  scanFolder:        (folder)                              => ipcRenderer.invoke('fs:scanFolder', folder),
  readFileAsBuffer:  (path)                                => ipcRenderer.invoke('fs:readFile', path),
  readAudioForPlayback: (path)                             => ipcRenderer.invoke('fs:readAudioForPlayback', path),
  getFileUrl:        (path)                                => ipcRenderer.invoke('fs:getFileUrl', path),
  getFileInfo:       (path)                                => ipcRenderer.invoke('fs:getFileInfo', path),
  checkFile:         (path)                                => ipcRenderer.invoke('fs:checkFile', path),
  checkFolderExists: (folderPath)                          => ipcRenderer.invoke('fs:checkFolderExists', folderPath),
  getDroppedPath:    (filePath)                            => ipcRenderer.invoke('fs:getDroppedPath', filePath),
  getDesktopPath:    ()                                    => ipcRenderer.invoke('fs:getDesktopPath'),
  renameFile:        (oldPath, newName)                    => ipcRenderer.invoke('fs:renameFile', oldPath, newName),

  // ID3 Tag operations
  readTags:           (filePath)                           => ipcRenderer.invoke('fs:readTags', filePath),
  updateTitle:        (filePath, newTitle)                 => ipcRenderer.invoke('fs:updateTitle', filePath, newTitle),
  updateCover:        (filePath, coverBase64)              => ipcRenderer.invoke('fs:updateCover', filePath, coverBase64),
  updateCoverOnAccept:(targetFolder, fileName, cover)      => ipcRenderer.invoke('fs:updateCoverOnAccept', targetFolder, fileName, cover),

  // Полные теги
  readFullTags:  (filePath)                                => ipcRenderer.invoke('fs:readFullTags', filePath),
  writeFullTags: (filePath, tagData)                       => ipcRenderer.invoke('fs:writeFullTags', filePath, tagData),

  // BPM / Key анализ
  analyzeBpm: (filePath)                                   => ipcRenderer.invoke('fs:analyzeBpm', filePath),
  analyzeKey: (filePath)                                   => ipcRenderer.invoke('fs:analyzeKey', filePath),

  // Пакетное переименование
  batchRename: (filePath, template)                        => ipcRenderer.invoke('fs:batchRename', filePath, template),

  // Broken files
  saveBrokenList: (folderPath, brokenFiles)                => ipcRenderer.invoke('fs:saveBrokenList', folderPath, brokenFiles),

  // Track operations
  acceptTrack: (src, targetFolder, mode)                   => ipcRenderer.invoke('fs:accept', src, targetFolder, mode),
  rejectTrack: (src, mode, rejectedFolder)                 => ipcRenderer.invoke('fs:reject', src, mode, rejectedFolder),

  // Trash/delete
  trashFolder:  (folderPath)                               => ipcRenderer.invoke('folder-browser:trash-folder', folderPath),
  deleteFolder: (folderPath)                               => ipcRenderer.invoke('folder-browser:delete-folder', folderPath),
});
