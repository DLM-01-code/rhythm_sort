const { BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

let browserWindow = null;
let resolvePromise = null;
let handlersRegistered = false;
const dirWatchers = new Map();

// Глобальный кэш всех когда-либо просмотренных папок
const globalCache = new Map();
const scanningQueue = new Set();
let isBackgroundScanning = false;

// Системные пути для предзагрузки
const SYSTEM_PATHS = [
  'C:\\',
  'D:\\',
  'E:\\',
  'C:\\Users',
  process.env.USERPROFILE,
  path.join(os.homedir(), 'Desktop'),
  path.join(os.homedir(), 'Documents'),
  path.join(os.homedir(), 'Downloads'),
  path.join(os.homedir(), 'Music'),
  path.join(os.homedir(), 'Videos'),
  path.join(os.homedir(), 'Pictures')
].filter(Boolean);

async function resolveShortcut(shortcutPath) {
  try {
    const escapedPath = shortcutPath.replace(/\\/g, '\\\\');
    const psCommand = `(New-Object -ComObject WScript.Shell).CreateShortcut('${escapedPath}').TargetPath`;
    const { stdout } = await execPromise(`powershell -Command "${psCommand}"`, { timeout: 2000 });
    let targetPath = stdout.trim();
    if (targetPath && targetPath !== '') {
      try {
        await fs.access(targetPath);
        return targetPath;
      } catch(e) {}
    }
  } catch (e) {}
  return null;
}

async function getDrives() {
  const drives = [];
  
  const desktopPath = path.join(os.homedir(), 'Desktop');
  try {
    await fs.access(desktopPath);
    drives.push({ name: '🖥️ Desktop', path: desktopPath, isDirectory: true });
  } catch(e) {}
  
  const homePath = os.homedir();
  try {
    await fs.access(homePath);
    drives.push({ name: '🏠 Home', path: homePath, isDirectory: true });
  } catch(e) {}
  
  const driveLetters = ['C:', 'D:', 'E:', 'F:', 'G:', 'H:', 'I:', 'J:', 'K:', 'L:', 'M:', 'N:', 'O:', 'P:', 'Q:', 'R:', 'S:', 'T:', 'U:', 'V:', 'W:', 'X:', 'Y:', 'Z:'];
  
  for (const drive of driveLetters) {
    try {
      await fs.access(drive + '\\');
      drives.push({ name: '💿 ' + drive, path: drive + '\\', isDirectory: true });
    } catch(e) {}
  }
  
  return drives;
}

// Быстрое сканирование папки (синхронное для скорости)
async function scanDirectoryFast(dirPath) {
  if (globalCache.has(dirPath)) {
    console.log('⚡ INSTANT from cache:', dirPath);
    return globalCache.get(dirPath);
  }
  
  console.log('🔍 First-time scan (will cache):', dirPath);
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const items = [];
    
    const skipFiles = new Set(['Thumbs.db', '.DS_Store', 'desktop.ini', '._.DS_Store', '.localized']);
    const audioExts = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'mp4', 'opus', 'wma']);
    
    const promises = [];
    
    for (const entry of entries) {
      if (skipFiles.has(entry.name)) continue;
      if (entry.name.startsWith('._')) continue;
      if (entry.name.startsWith('.')) continue;
      
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        items.push({
          name: entry.name,
          path: fullPath,
          isDirectory: true,
          isShortcut: false,
          isAudio: false,
          size: 0
        });
        
        if (!globalCache.has(fullPath) && !scanningQueue.has(fullPath)) {
          scanningQueue.add(fullPath);
          setTimeout(() => preloadFolderInBackground(fullPath), 100);
        }
        continue;
      }
      
      const ext = entry.name.split('.').pop()?.toLowerCase() || '';
      const isAudio = audioExts.has(ext);
      const isShortcut = entry.name.toLowerCase().endsWith('.lnk');
      
      if (isShortcut) {
        promises.push(resolveShortcut(fullPath).then(targetPath => {
          if (targetPath) {
            items.push({
              name: entry.name.replace(/\.lnk$/i, ''),
              path: targetPath,
              isDirectory: true,
              isShortcut: true,
              isAudio: false,
              size: 0
            });
          }
        }));
        continue;
      }
      
      if (isAudio) {
        items.push({
          name: entry.name,
          path: fullPath,
          isDirectory: false,
          isShortcut: false,
          isAudio: true,
          size: 0
        });
      }
    }
    
    await Promise.all(promises);
    
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    
    globalCache.set(dirPath, items);
    
    return items;
  } catch (error) {
    console.error('Error scanning directory:', error);
    return [];
  }
}

async function preloadFolderInBackground(folderPath) {
  if (globalCache.has(folderPath)) {
    scanningQueue.delete(folderPath);
    return;
  }
  
  console.log('🔄 BACKGROUND preloading:', folderPath);
  
  try {
    const entries = await fs.readdir(folderPath, { withFileTypes: true });
    const items = [];
    const skipFiles = new Set(['Thumbs.db', '.DS_Store', 'desktop.ini']);
    const audioExts = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'mp4', 'opus', 'wma']);
    
    for (const entry of entries) {
      if (skipFiles.has(entry.name)) continue;
      if (entry.name.startsWith('._')) continue;
      
      const fullPath = path.join(folderPath, entry.name);
      
      if (entry.isDirectory()) {
        items.push({
          name: entry.name,
          path: fullPath,
          isDirectory: true,
          isShortcut: false,
          isAudio: false,
          size: 0
        });
        continue;
      }
      
      const ext = entry.name.split('.').pop()?.toLowerCase() || '';
      const isAudio = audioExts.has(ext);
      const isShortcut = entry.name.toLowerCase().endsWith('.lnk');
      
      if (isShortcut) {
        const targetPath = await resolveShortcut(fullPath);
        if (targetPath) {
          items.push({
            name: entry.name.replace(/\.lnk$/i, ''),
            path: targetPath,
            isDirectory: true,
            isShortcut: true,
            isAudio: false,
            size: 0
          });
        }
      } else if (isAudio) {
        items.push({
          name: entry.name,
          path: fullPath,
          isDirectory: false,
          isShortcut: false,
          isAudio: true,
          size: 0
        });
      }
    }
    
    items.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });
    
    globalCache.set(folderPath, items);
    console.log('✅ BACKGROUND cached:', folderPath, `(${items.length} items)`);
    
    const subfolders = items.filter(i => i.isDirectory).slice(0, 3);
    for (const sub of subfolders) {
      if (!globalCache.has(sub.path) && !scanningQueue.has(sub.path)) {
        scanningQueue.add(sub.path);
        setTimeout(() => preloadFolderInBackground(sub.path), 500);
      }
    }
    
  } catch (error) {
    console.error('Background preload failed:', folderPath, error);
  } finally {
    scanningQueue.delete(folderPath);
  }
}

async function startBackgroundPreload() {
  if (isBackgroundScanning) return;
  isBackgroundScanning = true;
  
  console.log('🚀 Starting background filesystem preload...');
  
  for (const sysPath of SYSTEM_PATHS) {
    if (sysPath && !globalCache.has(sysPath) && !scanningQueue.has(sysPath)) {
      try {
        await fs.access(sysPath);
        scanningQueue.add(sysPath);
        await preloadFolderInBackground(sysPath);
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch(e) {}
    }
  }
  
  console.log('✅ Background preload complete. Cached:', globalCache.size, 'folders');
}

async function preloadFileSystem() {
  console.log('📁 Preloading file system in background...');
  await startBackgroundPreload();
}

async function createFolder(parentPath, folderName) {
  const newPath = path.join(parentPath, folderName);
  try {
    await fs.mkdir(newPath, { recursive: true });
    globalCache.delete(parentPath);
    await scanDirectoryFast(parentPath);
    return { success: true, path: newPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function renameFolder(oldPath, newName) {
  const dir = path.dirname(oldPath);
  const newPath = path.join(dir, newName);
  try {
    await fs.rename(oldPath, newPath);
    globalCache.delete(dir);
    globalCache.delete(oldPath);
    await scanDirectoryFast(dir);
    return { success: true, newPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

async function deleteFolder(folderPath) {
  try {
    await fs.rm(folderPath, { recursive: true, force: true });
    const parentPath = path.dirname(folderPath);
    globalCache.delete(parentPath);
    globalCache.delete(folderPath);
    await scanDirectoryFast(parentPath);
    return { success: true };
  } catch (error) {
    console.error('Error deleting folder:', error);
    return { success: false, error: error.message };
  }
}

async function trashFolder(folderPath) {
  try {
    // Экранируем путь для PowerShell
    const escapedPath = folderPath.replace(/\\/g, '\\\\').replace(/'/g, "''");
    // Пишем скрипт во временный файл чтобы избежать проблем с экранированием в командной строке
    const tmpScript = path.join(os.tmpdir(), 'rs_trash_' + Date.now() + '.ps1');
    const scriptContent = `Add-Type -AssemblyName Microsoft.VisualBasic\r\n[Microsoft.VisualBasic.FileIO.FileSystem]::DeleteDirectory('${escapedPath}', 'OnlyErrorDialogs', 'SendToRecycleBin')`;
    const fss = require('fs');
    fss.writeFileSync(tmpScript, scriptContent, 'utf8');
    await execPromise(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tmpScript}"`, { timeout: 8000 });
    try { fss.unlinkSync(tmpScript); } catch {}
    const parentPath = path.dirname(folderPath);
    globalCache.delete(parentPath);
    globalCache.delete(folderPath);
    const freshItems = await scanDirectoryFast(parentPath);
    return { success: true, items: freshItems };
  } catch (error) {
    console.error('Error trashing folder:', error);
    return { success: false, error: error.message };
  }
}

function registerHandlers() {
  if (handlersRegistered) return;
  
  ipcMain.handle('folder-browser:get-drives', async () => {
    return await getDrives();
  });
  
  ipcMain.handle('folder-browser:scan', async (event, dirPath) => {
    const items = await scanDirectoryFast(dirPath);
    return { success: true, items };
  });

  ipcMain.handle('folder-browser:scan-fresh', async (event, dirPath) => {
    globalCache.delete(dirPath);
    const items = await scanDirectoryFast(dirPath);
    return { success: true, items };
  });
  
  ipcMain.handle('folder-browser:create-folder', async (event, parentPath, folderName) => {
    return await createFolder(parentPath, folderName);
  });
  
  ipcMain.handle('folder-browser:rename-folder', async (event, oldPath, newName) => {
    return await renameFolder(oldPath, newName);
  });
  
  ipcMain.handle('folder-browser:delete-folder', async (event, folderPath) => {
    return await deleteFolder(folderPath);
  });

  ipcMain.handle('folder-browser:trash-folder', async (event, folderPath) => {
    return await trashFolder(folderPath);
  });
  
  ipcMain.on('folder-browser:select', (event, folderPath) => {
    if (resolvePromise) {
      resolvePromise(folderPath);
      resolvePromise = null;
    }
    if (browserWindow) browserWindow.close();
  });
  
  ipcMain.on('folder-browser:cancel', () => {
    if (resolvePromise) {
      resolvePromise(null);
      resolvePromise = null;
    }
    if (browserWindow) browserWindow.close();
  });
  
  ipcMain.handle('folder-browser:watch', async (event, dirPath) => {
    if (dirWatchers.has(dirPath)) {
      try { dirWatchers.get(dirPath).close(); } catch(e) {}
    }
    try {
      const fsSync = require('fs');
      let debounceTimer = null;
      const watcher = fsSync.watch(dirPath, { persistent: false }, (eventType, filename) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(async () => {
          globalCache.delete(dirPath);
          const freshItems = await scanDirectoryFast(dirPath);
          if (browserWindow && !browserWindow.isDestroyed()) {
            browserWindow.webContents.send('folder-browser:changed', { dirPath, items: freshItems });
          }
        }, 300);
      });
      dirWatchers.set(dirPath, watcher);
      return { success: true };
    } catch(e) {
      return { success: false, error: e.message };
    }
  });

  ipcMain.handle('folder-browser:unwatch', async (event, dirPath) => {
    if (dirWatchers.has(dirPath)) {
      try { dirWatchers.get(dirPath).close(); } catch(e) {}
      dirWatchers.delete(dirPath);
    }
    return { success: true };
  });

  handlersRegistered = true;
  
  setTimeout(() => startBackgroundPreload(), 1000);
}

function createFolderBrowser(startPathOverride) {
  registerHandlers();
  
  if (browserWindow) {
    browserWindow.focus();
    return new Promise((resolve) => {
      resolvePromise = resolve;
    });
  }

  const parentWindow = BrowserWindow.getFocusedWindow();
  
  browserWindow = new BrowserWindow({
    width: 850,
    height: 650,
    parent: parentWindow,
    modal: true,
    show: false,
    movable: true,
    titleBarStyle: 'default',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: 'Select Music Folder'
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Select Music Folder</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { 
      font-family: 'Segoe UI', system-ui, sans-serif;
      background: #1e1e2e; 
      color: #cdd6f4; 
      height: 100vh; 
      display: flex; 
      flex-direction: column; 
    }
    .title-bar {
      -webkit-app-region: drag;
      background: #313244;
      padding: 12px;
      text-align: center;
      font-weight: bold;
      border-bottom: 1px solid #45475a;
      user-select: none;
    }
    .toolbar {
      padding: 12px;
      background: #313244;
      border-bottom: 1px solid #45475a;
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }
    select, .action-btn, button {
      -webkit-app-region: no-drag;
    }
    select {
      flex: 2;
      padding: 8px 12px;
      background: #1e1e2e;
      color: #cdd6f4;
      border: 1px solid #45475a;
      border-radius: 6px;
      font-size: 14px;
      cursor: pointer;
      min-width: 150px;
    }
    select:hover { background: #45475a; }
    .path-bar {
      padding: 8px 12px;
      background: #1e1e2e;
      font-size: 11px;
      font-family: monospace;
      color: #89b4fa;
      border-bottom: 1px solid #45475a;
      word-break: break-all;
      cursor: pointer;
    }
    .path-bar:hover { background: #313244; }
    .stats {
      padding: 6px 12px;
      background: #313244;
      font-size: 11px;
      display: flex;
      justify-content: space-between;
    }
    .content {
      flex: 1;
      overflow-y: auto;
      padding: 8px;
    }
    .item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 8px 12px;
      cursor: pointer;
      border-radius: 6px;
      margin-bottom: 2px;
      transition: all 0.1s;
    }
    .item:hover { background: #313244; }
    .item.selected { background: #89b4fa; color: #1e1e2e; }
    .item.disabled { opacity: 0.5; cursor: default; }
    .item.disabled:hover { background: none; }
    .icon { font-size: 18px; width: 28px; }
    .name { flex: 1; font-size: 13px; word-break: break-word; }
    .info { font-size: 10px; color: #a6adc8; }
    .item.selected .info { color: #1e1e2e; }
    .empty {
      text-align: center;
      padding: 40px;
      color: #6c7086;
    }
    .footer {
      padding: 12px;
      border-top: 1px solid #45475a;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      background: #313244;
    }
    button {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: bold;
      font-size: 13px;
    }
    button.cancel {
      background: #45475a;
      color: #cdd6f4;
    }
    button.cancel:hover { background: #585b70; }
    button.select {
      background: #89b4fa;
      color: #1e1e2e;
    }
    button.select:hover { background: #b4befe; }
    .action-btn {
      background: #45475a;
      padding: 8px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      white-space: nowrap;
    }
    .action-btn:hover { background: #585b70; }
    .modal {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    }
    .modal-content {
      background: #313244;
      padding: 24px;
      border-radius: 12px;
      min-width: 350px;
    }
    .modal-content input {
      width: 100%;
      padding: 10px;
      margin: 15px 0;
      background: #1e1e2e;
      border: 1px solid #45475a;
      border-radius: 6px;
      color: #cdd6f4;
      font-size: 14px;
    }
    .modal-buttons {
      display: flex;
      gap: 10px;
      justify-content: flex-end;
    }
    .modal-buttons button {
      padding: 6px 12px;
    }
    .context-menu {
      position: fixed;
      background: #313244;
      border: 1px solid #45475a;
      border-radius: 8px;
      padding: 4px 0;
      min-width: 150px;
      z-index: 1000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .context-menu-item {
      padding: 8px 16px;
      cursor: pointer;
      transition: all 0.1s;
    }
    .context-menu-item:hover {
      background: #89b4fa;
      color: #1e1e2e;
    }
  </style>
</head>
<body>
  <div class="title-bar">📁 Select Music Folder</div>
  <div class="toolbar">
    <select id="driveSelect">
      <option value="">📁 Select drive or folder...</option>
    </select>
    <div class="action-btn" id="upBtn">⬆ Up</div>
    <div class="action-btn" id="desktopBtn">🖥️ Desktop</div>
    <div class="action-btn" id="newFolderBtn">📁 New Folder</div>
    <div class="action-btn" id="refreshBtn">🔄 Refresh</div>
    <div class="action-btn" id="trashModeBtn">♻️ Trash</div>
  </div>
  <div class="path-bar" id="currentPath">/</div>
  <div class="stats" id="stats">📁 Loading...</div>
  <div class="content" id="content"></div>
  <div class="footer">
    <button id="cancelBtn" class="cancel">Cancel</button>
    <button id="selectBtn" class="select">✅ Select This Folder</button>
  </div>

  <script>
    const { ipcRenderer } = require('electron');
    const os = require('os');
    let currentPath = '';
    let items = [];
    let selectedPath = '';
    let isLoading = false;
    
    function showModal(title, defaultValue, callback) {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = \`
        <div class="modal-content">
          <h3>\${title}</h3>
          <input type="text" id="modalInput" value="\${escapeHtml(defaultValue)}" autofocus>
          <div class="modal-buttons">
            <button id="modalCancel">Cancel</button>
            <button id="modalOk">OK</button>
          </div>
        </div>
      \`;
      document.body.appendChild(modal);
      
      const input = modal.querySelector('#modalInput');
      setTimeout(() => input?.select(), 100);
      
      modal.querySelector('#modalOk').onclick = () => {
        const value = input.value.trim();
        if (value) callback(value);
        modal.remove();
      };
      
      modal.querySelector('#modalCancel').onclick = () => modal.remove();
      
      input.onkeydown = (e) => {
        if (e.key === 'Enter') {
          const value = input.value.trim();
          if (value) callback(value);
          modal.remove();
        }
        if (e.key === 'Escape') modal.remove();
      };
    }
    
    function showConfirm(title, callback) {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = \`
        <div class="modal-content">
          <h3>\${title}</h3>
          <div class="modal-buttons">
            <button id="modalCancel">No</button>
            <button id="modalOk">Yes</button>
          </div>
        </div>
      \`;
      document.body.appendChild(modal);
      
      modal.querySelector('#modalOk').onclick = () => {
        callback(true);
        modal.remove();
      };
      
      modal.querySelector('#modalCancel').onclick = () => {
        callback(false);
        modal.remove();
      };
    }
    
    function getUniqueFolderName(baseName) {
      let counter = 1;
      let newName = baseName;
      const existingNames = items.filter(i => i.isDirectory).map(i => i.name);
      
      while (existingNames.includes(newName)) {
        counter++;
        newName = \`\${baseName} (\${counter})\`;
      }
      return newName;
    }
    
    async function loadDrives() {
      const result = await ipcRenderer.invoke('folder-browser:get-drives');
      const select = document.getElementById('driveSelect');
      select.innerHTML = '<option value="">📁 Select drive or folder...</option>';
      for (const drive of result) {
        const option = document.createElement('option');
        option.value = drive.path;
        option.textContent = drive.name;
        select.appendChild(option);
      }
    }
    
    function updateStats() {
      const folders = items.filter(i => i.isDirectory).length;
      const audioFiles = items.filter(i => i.isAudio).length;
      document.getElementById('stats').innerHTML = \`📁 Folders: \${folders}  |  🎵 Audio: \${audioFiles}\`;
    }
    
    function createFolderElement(folder) {
      const div = document.createElement('div');
      div.className = 'item';
      if (selectedPath === folder.path) div.classList.add('selected');
      
      const icon = folder.isShortcut ? '🔗' : '📁';
      const info = folder.isShortcut ? 'Shortcut' : 'Folder';
      div.innerHTML = \`
        <div class="icon">\${icon}</div>
        <div class="name">\${escapeHtml(folder.name)}</div>
        <div class="info">\${info}</div>
      \`;
      
      div.setAttribute('data-path', folder.path);
      
      div.onclick = (e) => {
        e.stopPropagation();
        selectedPath = folder.path;
        highlightSelectedFolder();
      };
      div.ondblclick = (e) => {
        e.stopPropagation();
        loadDirectory(folder.path);
      };
      
      div.oncontextmenu = (e) => {
        e.preventDefault();
        e.stopPropagation();
        selectedPath = folder.path;
        highlightSelectedFolder();
        
        const oldMenu = document.querySelector('.context-menu');
        if (oldMenu) oldMenu.remove();
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.innerHTML = \`
          <div class="context-menu-item" data-action="rename">✏️ Rename</div>
          <div class="context-menu-item" data-action="trash">♻️ Move to Trash</div>
          <div class="context-menu-item" data-action="delete">🗑️ Delete Permanently</div>
        \`;
        document.body.appendChild(menu);
        
        menu.querySelector('[data-action="rename"]').onclick = () => {
          renameFolderItem(folder.path, folder.name);
          menu.remove();
        };
        menu.querySelector('[data-action="trash"]').onclick = async () => {
          menu.remove();
          const result = await ipcRenderer.invoke('folder-browser:trash-folder', folder.path);
          if (result.success) {
            if (selectedPath === folder.path) selectedPath = '';
            items = result.items;
            renderItems();
            updateStats();
          } else {
            alert('Failed to move to trash: ' + result.error);
          }
        };
        menu.querySelector('[data-action="delete"]').onclick = () => {
          deleteFolderItem(folder.path, folder.name);
          menu.remove();
        };
        
        const closeMenu = (e) => {
          if (!menu.contains(e.target)) {
            menu.remove();
            document.removeEventListener('click', closeMenu);
          }
        };
        setTimeout(() => document.addEventListener('click', closeMenu), 100);
      };
      
      return div;
    }
    
    function highlightSelectedFolder() {
      const container = document.getElementById('content');
      for (let i = 0; i < container.children.length; i++) {
        const child = container.children[i];
        const path = child.getAttribute('data-path');
        if (path === selectedPath) {
          child.classList.add('selected');
        } else {
          child.classList.remove('selected');
        }
      }
    }
    
    async function loadDirectory(dirPath) {
      if (!dirPath || isLoading) return;
      isLoading = true;
      currentPath = dirPath;
      // ✅ Запоминаем последнюю папку
      try { localStorage.setItem('folder-browser-last-path', dirPath); } catch {}
      let displayPath = dirPath;
      const desktopPath = os.homedir() + '\\\\Desktop';
      if (dirPath === desktopPath) {
        displayPath = 'Desktop';
      } else if (dirPath === os.homedir()) {
        displayPath = 'Home';
      }
      document.getElementById('currentPath').textContent = displayPath;
      document.getElementById('currentPath').title = dirPath;
      
      try {
        const result = await ipcRenderer.invoke('folder-browser:scan', dirPath);
        
        if (result.success) {
          items = result.items;
          renderItems();
          updateStats();
        } else {
          document.getElementById('content').innerHTML = '<div class="empty">❌ Error</div>';
        }
      } catch (err) {
        document.getElementById('content').innerHTML = '<div class="empty">❌ Error: ' + err.message + '</div>';
      } finally {
        isLoading = false;
      }
    }
    
    async function createNewFolder() {
      const defaultName = getUniqueFolderName('New Folder');
      showModal('New Folder Name', defaultName, async (folderName) => {
        const result = await ipcRenderer.invoke('folder-browser:create-folder', currentPath, folderName);
        if (result.success) {
          const newFolder = {
            name: folderName,
            path: result.path,
            isDirectory: true,
            isShortcut: false,
            isAudio: false,
            size: 0
          };
          
          items.push(newFolder);
          items.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
          });
          
          const container = document.getElementById('content');
          const div = createFolderElement(newFolder);
          container.appendChild(div);
          updateStats();
          selectedPath = result.path;
          highlightSelectedFolder();
        } else {
          alert('Failed to create folder: ' + result.error);
        }
      });
    }
    
    async function renameFolderItem(itemPath, currentName) {
      showModal('Rename Folder', currentName, async (newName) => {
        if (newName === currentName) return;
        
        const exists = items.some(i => i.isDirectory && i.name === newName && i.path !== itemPath);
        if (exists) {
          alert('A folder with this name already exists!');
          return;
        }
        
        const result = await ipcRenderer.invoke('folder-browser:rename-folder', itemPath, newName);
        if (result.success) {
          const itemIndex = items.findIndex(i => i.path === itemPath);
          if (itemIndex !== -1) {
            items[itemIndex].name = newName;
            items[itemIndex].path = result.newPath;
            
            const div = document.querySelector(\`.item[data-path="\${itemPath}"]\`);
            if (div) {
              const nameSpan = div.querySelector('.name');
              if (nameSpan) nameSpan.textContent = newName;
              div.setAttribute('data-path', result.newPath);
            }
            
            if (selectedPath === itemPath) {
              selectedPath = result.newPath;
            }
          }
        } else {
          alert('Failed to rename folder: ' + result.error);
        }
      });
    }
    
    async function deleteFolderItem(itemPath, itemName) {
      showConfirm(\`⚠️ Delete folder "\${itemName}"?\n\nThis will delete the folder and ALL files inside it!\nThis action cannot be undone.\`, async (confirmed) => {
        if (!confirmed) return;
        const result = await ipcRenderer.invoke('folder-browser:delete-folder', itemPath);
        if (result.success) {
          const itemIndex = items.findIndex(i => i.path === itemPath);
          if (itemIndex !== -1) {
            items.splice(itemIndex, 1);
            const div = document.querySelector(\`.item[data-path="\${itemPath}"]\`);
            if (div) div.remove();
            updateStats();
            
            if (selectedPath === itemPath) {
              selectedPath = '';
            }
          }
        } else {
          alert('Failed to delete folder: ' + result.error);
        }
      });
    }
    
    function getParentPath(p) {
      if (p === 'C:\\\\' || p === 'D:\\\\' || p === 'E:\\\\' || p === 'F:\\\\') return null;
      const parts = p.split(/[\\\\/]/);
      parts.pop();
      if (parts.length === 0) return null;
      if (parts.length === 1 && parts[0] === '') return null;
      let result = parts.join('\\\\');
      if (result.length === 2 && result[1] === ':') result += '\\\\';
      return result;
    }
    
    function renderItems() {
      const container = document.getElementById('content');
      if (items.length === 0) {
        container.innerHTML = '<div class="empty">📁 Folder is empty</div>';
        return;
      }
      
      container.innerHTML = '';
      
      for (const item of items) {
        if (item.isDirectory) {
          const div = createFolderElement(item);
          container.appendChild(div);
        } else if (item.isAudio) {
          const div = document.createElement('div');
          div.className = 'item disabled';
          div.innerHTML = '<div class="icon">🎵</div><div class="name">' + escapeHtml(item.name) + '</div><div class="info"></div>';
          container.appendChild(div);
        }
      }
    }
    
    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
    
    document.getElementById('driveSelect').onchange = (e) => {
      const path = e.target.value;
      if (path) {
        selectedPath = '';
        loadDirectory(path);
      }
    };
    
    document.getElementById('upBtn').onclick = () => {
      const parent = getParentPath(currentPath);
      if (parent) {
        selectedPath = '';
        loadDirectory(parent);
      }
    };
    
    document.getElementById('desktopBtn').onclick = () => {
      const desktopPath = os.homedir() + '\\\\Desktop';
      selectedPath = '';
      loadDirectory(desktopPath);
    };
    
    document.getElementById('newFolderBtn').onclick = () => {
      createNewFolder();
    };
    
    document.getElementById('selectBtn').onclick = () => {
      const folderToSelect = selectedPath || currentPath;
      if (folderToSelect && folderToSelect !== '/' && folderToSelect !== '') {
        ipcRenderer.send('folder-browser:select', folderToSelect);
      } else {
        alert('Select a folder');
      }
    };
    
    document.getElementById('cancelBtn').onclick = () => {
      ipcRenderer.send('folder-browser:cancel');
    };
    
    let watchedPath = '';

    ipcRenderer.on('folder-browser:changed', (event, { dirPath, items: newItems }) => {
      if (dirPath === currentPath) {
        items = newItems;
        renderItems();
        updateStats();
        highlightSelectedFolder();
      }
    });

    async function watchCurrentDir(dirPath) {
      if (watchedPath && watchedPath !== dirPath) {
        await ipcRenderer.invoke('folder-browser:unwatch', watchedPath).catch(() => {});
      }
      watchedPath = dirPath;
      await ipcRenderer.invoke('folder-browser:watch', dirPath).catch(() => {});
    }

    const _origLoad = loadDirectory;
    loadDirectory = async function(dirPath) {
      await _origLoad(dirPath);
      watchCurrentDir(dirPath);
    };

    window.onload = async () => {
      await loadDrives();
      // ✅ Приоритет: 1) startPath от вызывающей стороны, 2) последняя папка, 3) Desktop
      let startPath = window.__RS_START_PATH__ || '';
      if (!startPath) {
        try { startPath = localStorage.getItem('folder-browser-last-path') || ''; } catch {}
      }
      if (!startPath) startPath = os.homedir() + '\\\\Desktop';
      try {
        const fsCheck = require('fs');
        if (!fsCheck.existsSync(startPath)) startPath = os.homedir() + '\\\\Desktop';
      } catch {}
      loadDirectory(startPath);
    };
  </script>
</body>
</html>`;

  browserWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);

  // ✅ Инжектируем startPath сразу после загрузки DOM — до window.onload
  browserWindow.webContents.once('dom-ready', () => {
    if (startPathOverride) {
      const escaped = JSON.stringify(startPathOverride);
      browserWindow.webContents.executeJavaScript(
        `window.__RS_START_PATH__ = ${escaped};`
      ).catch(() => {});
    }
  });

  browserWindow.once('ready-to-show', () => {
    browserWindow.show();
  });
  
  browserWindow.on('closed', () => {
    for (const [, watcher] of dirWatchers) {
      try { watcher.close(); } catch(e) {}
    }
    dirWatchers.clear();
    browserWindow = null;
    if (resolvePromise) {
      resolvePromise(null);
      resolvePromise = null;
    }
  });
  
  return new Promise((resolve) => {
    resolvePromise = resolve;
  });
}

module.exports = { createFolderBrowser, preloadFileSystem };