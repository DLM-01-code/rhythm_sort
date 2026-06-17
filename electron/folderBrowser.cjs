const { BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fss = require('fs');
const os = require('os');

let browserWindow = null;
let resolvePromise = null;
let handlersRegistered = false;
const dirWatchers = new Map();
const globalCache = new Map();
const scanningQueue = new Set();

const IS_MAC = process.platform === 'darwin';
const HOME = os.homedir();

// Mac быстрые пути (аналог Windows drives)
const SYSTEM_PATHS = [
  path.join(HOME, 'Desktop'),
  HOME,
  path.join(HOME, 'Music'),
  path.join(HOME, 'Downloads'),
  path.join(HOME, 'Documents'),
].filter(Boolean);

async function getDrives() {
  const drives = [];

  const quickPaths = [
    { name: '🖥️ Desktop',  path: path.join(HOME, 'Desktop') },
    { name: '🏠 Home',      path: HOME },
    { name: '🎵 Music',     path: path.join(HOME, 'Music') },
    { name: '📥 Downloads', path: path.join(HOME, 'Downloads') },
    { name: '📄 Documents', path: path.join(HOME, 'Documents') },
  ];

  for (const qp of quickPaths) {
    try { await fs.access(qp.path); drives.push({ name: qp.name, path: qp.path, isDirectory: true }); }
    catch(e) {}
  }

  // Mac: внешние диски через /Volumes
  if (IS_MAC) {
    try {
      const vols = await fs.readdir('/Volumes', { withFileTypes: true });
      for (const v of vols) {
        if (v.isDirectory() && !v.name.startsWith('.')) {
          drives.push({ name: `💿 ${v.name}`, path: `/Volumes/${v.name}`, isDirectory: true });
        }
      }
    } catch(e) {}
  }

  return drives;
}

async function scanDirectoryFast(dirPath) {
  if (globalCache.has(dirPath)) {
    console.log('⚡ INSTANT from cache:', dirPath);
    return globalCache.get(dirPath);
  }

  console.log('🔍 First-time scan:', dirPath);

  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    const items = [];
    const skipFiles = new Set(['Thumbs.db', '.DS_Store', 'desktop.ini', '._.DS_Store', '.localized']);
    const audioExts = new Set(['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'mp4', 'opus', 'wma', 'aiff', 'aif', 'alac']);

    for (const entry of entries) {
      if (skipFiles.has(entry.name)) continue;
      if (entry.name.startsWith('._')) continue;
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(dirPath, entry.name);

      if (entry.isDirectory()) {
        items.push({
          name: entry.name, path: fullPath,
          isDirectory: true, isShortcut: false, isAudio: false, size: 0
        });
        if (!globalCache.has(fullPath) && !scanningQueue.has(fullPath)) {
          scanningQueue.add(fullPath);
          setTimeout(() => preloadFolderInBackground(fullPath), 100);
        }
        continue;
      }

      const ext = entry.name.split('.').pop()?.toLowerCase() || '';
      if (audioExts.has(ext)) {
        items.push({
          name: entry.name, path: fullPath,
          isDirectory: false, isShortcut: false, isAudio: true, size: 0
        });
      }
    }

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
  if (globalCache.has(folderPath)) { scanningQueue.delete(folderPath); return; }
  try {
    await scanDirectoryFast(folderPath);
    console.log('✅ BACKGROUND cached:', folderPath);
  } catch(e) {}
  finally { scanningQueue.delete(folderPath); }
}

async function startBackgroundPreload() {
  for (const sysPath of SYSTEM_PATHS) {
    if (sysPath && !globalCache.has(sysPath) && !scanningQueue.has(sysPath)) {
      try {
        await fs.access(sysPath);
        scanningQueue.add(sysPath);
        await preloadFolderInBackground(sysPath);
        await new Promise(r => setTimeout(r, 100));
      } catch(e) {}
    }
  }
  console.log('✅ Background preload complete. Cached:', globalCache.size, 'folders');
}

async function createFolder(parentPath, folderName) {
  const newPath = path.join(parentPath, folderName);
  try {
    await fs.mkdir(newPath, { recursive: true });
    globalCache.delete(parentPath);
    await scanDirectoryFast(parentPath);
    return { success: true, path: newPath };
  } catch (error) { return { success: false, error: error.message }; }
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
  } catch (error) { return { success: false, error: error.message }; }
}

async function deleteFolder(folderPath) {
  try {
    await fs.rm(folderPath, { recursive: true, force: true });
    const parentPath = path.dirname(folderPath);
    globalCache.delete(parentPath);
    globalCache.delete(folderPath);
    await scanDirectoryFast(parentPath);
    return { success: true };
  } catch (error) { return { success: false, error: error.message }; }
}

async function trashFolder(folderPath) {
  try {
    // Mac: используем shell.trashItem (встроено в Electron)
    await shell.trashItem(folderPath);
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

  ipcMain.handle('folder-browser:get-drives', async () => getDrives());

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
    if (resolvePromise) { resolvePromise(folderPath); resolvePromise = null; }
    if (browserWindow) browserWindow.close();
  });

  ipcMain.on('folder-browser:cancel', () => {
    if (resolvePromise) { resolvePromise(null); resolvePromise = null; }
    if (browserWindow) browserWindow.close();
  });

  ipcMain.handle('folder-browser:watch', async (event, dirPath) => {
    if (dirWatchers.has(dirPath)) {
      try { dirWatchers.get(dirPath).close(); } catch(e) {}
    }
    try {
      let debounceTimer = null;
      const watcher = fss.watch(dirPath, { persistent: false }, (eventType, filename) => {
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
    } catch(e) { return { success: false, error: e.message }; }
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

  // ✅ Проверяем что окно реально живо — если оно "залипло" (destroyed но
  // переменная не сброшена), сбрасываем состояние перед новым открытием
  if (browserWindow) {
    if (browserWindow.isDestroyed()) {
      browserWindow = null;
      if (resolvePromise) { resolvePromise(null); resolvePromise = null; }
    } else {
      browserWindow.focus();
      return new Promise((resolve) => { resolvePromise = resolve; });
    }
  }

  // ✅ Если предыдущий промис не был разрезолвен (окно закрылось без
  // события 'closed' из-за краша) — резолвим его как null перед новым вызовом
  if (resolvePromise) {
    const oldResolve = resolvePromise;
    resolvePromise = null;
    oldResolve(null);
  }

  // ✅ Очищаем кэш при каждом новом открытии — после массовых операций
  // (accept/reject множества файлов) кэш может содержать устаревшие списки
  globalCache.clear();
  scanningQueue.clear();

  const startPathScript = startPathOverride
    ? `<script>window.__RS_START_PATH__=${JSON.stringify(startPathOverride)};</script>`
    : '';

  // Mac-адаптированный HTML: убраны Windows-пути, добавлены Mac-пути
  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Select Music Folder</title>
  ${startPathScript}
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, 'Segoe UI', system-ui, sans-serif;
      background: #1e1e2e;
      color: #cdd6f4;
      height: 100vh;
      display: flex;
      flex-direction: column;
    }
    .title-bar {
      -webkit-app-region: drag;
      background: #313244;
      padding: 12px 12px 12px 80px;
      text-align: center;
      font-weight: bold;
      border-bottom: 1px solid #45475a;
      user-select: none;
      font-size: 14px;
    }
    .toolbar {
      padding: 10px 12px;
      background: #313244;
      border-bottom: 1px solid #45475a;
      display: flex;
      gap: 8px;
      align-items: center;
      flex-wrap: wrap;
      -webkit-app-region: no-drag;
    }
    select, .action-btn, button { -webkit-app-region: no-drag; }
    select {
      flex: 2;
      padding: 7px 10px;
      background: #1e1e2e;
      color: #cdd6f4;
      border: 1px solid #45475a;
      border-radius: 6px;
      font-size: 13px;
      cursor: pointer;
      min-width: 140px;
    }
    select:hover { background: #45475a; }
    .path-bar {
      padding: 6px 12px;
      background: #1e1e2e;
      font-size: 11px;
      font-family: monospace;
      color: #89b4fa;
      border-bottom: 1px solid #45475a;
      word-break: break-all;
      min-height: 26px;
    }
    .stats {
      padding: 5px 12px;
      background: #313244;
      font-size: 11px;
      color: #a6adc8;
      border-bottom: 1px solid #45475a;
      display: flex;
      justify-content: space-between;
    }
    .content { flex: 1; overflow-y: auto; padding: 6px; }
    .item {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 7px 12px;
      cursor: pointer;
      border-radius: 6px;
      margin-bottom: 2px;
      transition: background 0.1s;
    }
    .item:hover { background: #313244; }
    .item.selected { background: #89b4fa; color: #1e1e2e; }
    .item.disabled { opacity: 0.45; cursor: default; pointer-events: none; }
    .icon { font-size: 17px; width: 26px; text-align: center; flex-shrink: 0; }
    .name { flex: 1; font-size: 13px; word-break: break-word; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .info { font-size: 10px; color: #a6adc8; flex-shrink: 0; }
    .item.selected .info { color: #1e1e2e99; }
    .empty { text-align: center; padding: 40px; color: #6c7086; font-size: 13px; }
    .footer {
      padding: 10px 12px;
      border-top: 1px solid #45475a;
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      background: #313244;
      -webkit-app-region: no-drag;
    }
    button {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-weight: bold;
      font-size: 13px;
    }
    button.cancel { background: #45475a; color: #cdd6f4; }
    button.cancel:hover { background: #585b70; }
    button.select { background: #89b4fa; color: #1e1e2e; }
    button.select:hover { background: #b4befe; }
    .action-btn {
      background: #45475a;
      padding: 7px 11px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 12px;
      white-space: nowrap;
      border: none;
      color: #cdd6f4;
      flex-shrink: 0;
    }
    .action-btn:hover { background: #585b70; }
    .modal {
      position: fixed; top: 0; left: 0; width: 100%; height: 100%;
      background: rgba(0,0,0,0.65);
      display: flex; justify-content: center; align-items: center; z-index: 1000;
    }
    .modal-content {
      background: #313244; padding: 22px; border-radius: 10px;
      min-width: 320px; border: 1px solid #45475a;
    }
    .modal-content h3 { margin-bottom: 14px; font-size: 14px; }
    .modal-content input {
      width: 100%; padding: 9px 10px; margin: 0 0 14px;
      background: #1e1e2e; border: 1px solid #45475a;
      border-radius: 6px; color: #cdd6f4; font-size: 13px;
    }
    .modal-buttons { display: flex; gap: 8px; justify-content: flex-end; }
    .modal-buttons button { padding: 7px 14px; font-size: 13px; }
    .context-menu {
      position: fixed; background: #313244; border: 1px solid #45475a;
      border-radius: 8px; padding: 4px 0; min-width: 160px;
      z-index: 1000; box-shadow: 0 4px 14px rgba(0,0,0,0.35);
    }
    .context-menu-item { padding: 8px 16px; cursor: pointer; font-size: 13px; }
    .context-menu-item:hover { background: #89b4fa; color: #1e1e2e; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-track { background: #1e1e2e; }
    ::-webkit-scrollbar-thumb { background: #45475a; border-radius: 3px; }
  </style>
</head>
<body>
  <div class="title-bar">📁 Select Music Folder</div>
  <div class="toolbar">
    <select id="driveSelect">
      <option value="">📁 Quick access...</option>
    </select>
    <div class="action-btn" id="upBtn">⬆ Up</div>
    <div class="action-btn" id="desktopBtn">🖥️ Desktop</div>
    <div class="action-btn" id="newFolderBtn">📁 New</div>
    <div class="action-btn" id="refreshBtn">🔄</div>
  </div>
  <div class="path-bar" id="currentPath"></div>
  <div class="stats" id="stats">📁 Loading...</div>
  <div class="content" id="content"></div>
  <div class="footer">
    <button id="cancelBtn" class="cancel">Cancel</button>
    <button id="selectBtn" class="select">✅ Select This Folder</button>
  </div>

  <script>
    const { ipcRenderer } = require('electron');
    const pathMod = require('path');
    const os = require('os');

    let currentPath = '';
    let items = [];
    let selectedPath = '';
    let isLoading = false;

    const HOME = os.homedir();
    const DESKTOP = pathMod.join(HOME, 'Desktop');

    function showModal(title, defaultValue, callback) {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = \`<div class="modal-content">
        <h3>\${escapeHtml(title)}</h3>
        <input type="text" id="modalInput" value="\${escapeHtml(defaultValue)}">
        <div class="modal-buttons">
          <button id="modalCancel" class="cancel">Cancel</button>
          <button id="modalOk" class="select">OK</button>
        </div></div>\`;
      document.body.appendChild(modal);
      const input = modal.querySelector('#modalInput');
      setTimeout(() => { input.focus(); input.select(); }, 50);
      const ok = () => { const v = input.value.trim(); if (v) callback(v); modal.remove(); };
      modal.querySelector('#modalOk').onclick = ok;
      modal.querySelector('#modalCancel').onclick = () => modal.remove();
      input.onkeydown = (e) => { if (e.key === 'Enter') ok(); if (e.key === 'Escape') modal.remove(); };
    }

    function showConfirm(title, callback) {
      const modal = document.createElement('div');
      modal.className = 'modal';
      modal.innerHTML = \`<div class="modal-content">
        <h3>\${escapeHtml(title)}</h3>
        <div class="modal-buttons">
          <button id="modalCancel" class="cancel">No</button>
          <button id="modalOk" class="select">Yes</button>
        </div></div>\`;
      document.body.appendChild(modal);
      modal.querySelector('#modalOk').onclick = () => { callback(true); modal.remove(); };
      modal.querySelector('#modalCancel').onclick = () => { callback(false); modal.remove(); };
    }

    function getUniqueFolderName(baseName) {
      let counter = 1, newName = baseName;
      const existing = items.filter(i => i.isDirectory).map(i => i.name);
      while (existing.includes(newName)) { counter++; newName = \`\${baseName} (\${counter})\`; }
      return newName;
    }

    async function loadDrives() {
      const result = await ipcRenderer.invoke('folder-browser:get-drives');
      const select = document.getElementById('driveSelect');
      select.innerHTML = '<option value="">📁 Quick access...</option>';
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
      div.innerHTML = \`
        <div class="icon">\${folder.isShortcut ? '🔗' : '📁'}</div>
        <div class="name">\${escapeHtml(folder.name)}</div>
        <div class="info">\${folder.isShortcut ? 'alias' : 'folder'}</div>\`;
      div.setAttribute('data-path', folder.path);

      div.onclick = (e) => { e.stopPropagation(); selectedPath = folder.path; highlightSelectedFolder(); };
      div.ondblclick = (e) => { e.stopPropagation(); loadDirectory(folder.path); };

      div.oncontextmenu = (e) => {
        e.preventDefault(); e.stopPropagation();
        selectedPath = folder.path; highlightSelectedFolder();
        const oldMenu = document.querySelector('.context-menu');
        if (oldMenu) oldMenu.remove();
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = e.clientX + 'px';
        menu.style.top = e.clientY + 'px';
        menu.innerHTML = \`
          <div class="context-menu-item" data-action="rename">✏️ Rename</div>
          <div class="context-menu-item" data-action="trash">🗑️ Move to Trash</div>
          <div class="context-menu-item" data-action="delete">⛔ Delete Permanently</div>\`;
        document.body.appendChild(menu);
        menu.querySelector('[data-action="rename"]').onclick = () => { renameFolderItem(folder.path, folder.name); menu.remove(); };
        menu.querySelector('[data-action="trash"]').onclick = async () => {
          menu.remove();
          const result = await ipcRenderer.invoke('folder-browser:trash-folder', folder.path);
          if (result.success) {
            if (selectedPath === folder.path) selectedPath = '';
            items = result.items;
            renderItems(); updateStats();
          } else { alert('Failed to move to trash: ' + result.error); }
        };
        menu.querySelector('[data-action="delete"]').onclick = () => { deleteFolderItem(folder.path, folder.name); menu.remove(); };
        const closeMenu = (e) => { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('click', closeMenu); } };
        setTimeout(() => document.addEventListener('click', closeMenu), 100);
      };
      return div;
    }

    function highlightSelectedFolder() {
      const container = document.getElementById('content');
      for (const child of container.children) {
        const p = child.getAttribute('data-path');
        child.classList.toggle('selected', p === selectedPath);
      }
    }

    async function loadDirectory(dirPath) {
      if (!dirPath || isLoading) return;
      isLoading = true;
      currentPath = dirPath;
      try { localStorage.setItem('folder-browser-last-path', dirPath); } catch {}

      let displayPath = dirPath;
      if (dirPath === DESKTOP) displayPath = 'Desktop';
      else if (dirPath === HOME) displayPath = 'Home';
      document.getElementById('currentPath').textContent = displayPath;
      document.getElementById('currentPath').title = dirPath;

      try {
        const result = await ipcRenderer.invoke('folder-browser:scan', dirPath);
        if (result.success) { items = result.items; renderItems(); updateStats(); }
        else document.getElementById('content').innerHTML = '<div class="empty">❌ Error reading folder</div>';
      } catch (err) {
        document.getElementById('content').innerHTML = '<div class="empty">❌ ' + err.message + '</div>';
      } finally { isLoading = false; }
    }

    async function createNewFolder() {
      const defaultName = getUniqueFolderName('New Folder');
      showModal('New Folder Name', defaultName, async (folderName) => {
        const result = await ipcRenderer.invoke('folder-browser:create-folder', currentPath, folderName);
        if (result.success) {
          const newFolder = { name: folderName, path: result.path, isDirectory: true, isShortcut: false, isAudio: false, size: 0 };
          items.push(newFolder);
          items.sort((a, b) => {
            if (a.isDirectory && !b.isDirectory) return -1;
            if (!a.isDirectory && b.isDirectory) return 1;
            return a.name.localeCompare(b.name);
          });
          renderItems(); updateStats();
          selectedPath = result.path; highlightSelectedFolder();
        } else { alert('Failed to create folder: ' + result.error); }
      });
    }

    async function renameFolderItem(itemPath, currentName) {
      showModal('Rename Folder', currentName, async (newName) => {
        if (newName === currentName) return;
        const result = await ipcRenderer.invoke('folder-browser:rename-folder', itemPath, newName);
        if (result.success) {
          const idx = items.findIndex(i => i.path === itemPath);
          if (idx !== -1) { items[idx].name = newName; items[idx].path = result.newPath; }
          if (selectedPath === itemPath) selectedPath = result.newPath;
          renderItems(); updateStats();
        } else { alert('Failed to rename: ' + result.error); }
      });
    }

    async function deleteFolderItem(itemPath, itemName) {
      showConfirm(\`⚠️ Delete "\${itemName}"?\n\nThis will permanently delete all files inside!\`, async (confirmed) => {
        if (!confirmed) return;
        const result = await ipcRenderer.invoke('folder-browser:delete-folder', itemPath);
        if (result.success) {
          items = items.filter(i => i.path !== itemPath);
          if (selectedPath === itemPath) selectedPath = '';
          renderItems(); updateStats();
        } else { alert('Failed to delete: ' + result.error); }
      });
    }

    function getParentPath(p) {
      const parent = pathMod.dirname(p);
      return parent === p ? null : parent;
    }

    function renderItems() {
      const container = document.getElementById('content');
      if (items.length === 0) { container.innerHTML = '<div class="empty">📁 Folder is empty</div>'; return; }
      container.innerHTML = '';
      for (const item of items) {
        if (item.isDirectory) {
          container.appendChild(createFolderElement(item));
        } else if (item.isAudio) {
          const div = document.createElement('div');
          div.className = 'item disabled';
          div.innerHTML = '<div class="icon">🎵</div><div class="name">' + escapeHtml(item.name) + '</div><div class="info">audio</div>';
          container.appendChild(div);
        }
      }
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = String(text || '');
      return div.innerHTML;
    }

    document.getElementById('driveSelect').onchange = (e) => {
      const p = e.target.value;
      if (p) { selectedPath = ''; loadDirectory(p); e.target.value = ''; }
    };
    document.getElementById('upBtn').onclick = () => {
      const parent = getParentPath(currentPath);
      if (parent) { selectedPath = ''; loadDirectory(parent); }
    };
    document.getElementById('desktopBtn').onclick = () => { selectedPath = ''; loadDirectory(DESKTOP); };
    document.getElementById('newFolderBtn').onclick = () => createNewFolder();
    document.getElementById('refreshBtn').onclick = async () => {
      await ipcRenderer.invoke('folder-browser:scan-fresh', currentPath);
      loadDirectory(currentPath);
    };
    document.getElementById('selectBtn').onclick = () => {
      const folderToSelect = selectedPath || currentPath;
      if (folderToSelect) ipcRenderer.send('folder-browser:select', folderToSelect);
      else alert('Select a folder');
    };
    document.getElementById('cancelBtn').onclick = () => ipcRenderer.send('folder-browser:cancel');

    // Live folder watching
    ipcRenderer.on('folder-browser:changed', (event, { dirPath, items: newItems }) => {
      if (dirPath === currentPath) { items = newItems; renderItems(); updateStats(); highlightSelectedFolder(); }
    });

    let watchedPath = '';
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
      let startPath = window.__RS_START_PATH__ || '';
      if (!startPath) {
        try { startPath = localStorage.getItem('folder-browser-last-path') || ''; } catch {}
      }
      if (!startPath) startPath = DESKTOP;
      try {
        const fsCheck = require('fs');
        if (!fsCheck.existsSync(startPath)) startPath = DESKTOP;
      } catch {}
      loadDirectory(startPath);
    };
  </script>
</body>
</html>`;

  const tmpPath = require('path').join(require('os').tmpdir(), 'rhythmsort_browser_' + Date.now() + '.html');
  fss.writeFileSync(tmpPath, html, 'utf-8');

  const { BrowserWindow: BW } = require('electron');
  const parentWin = BW.getFocusedWindow() || BW.getAllWindows()[0] || null;
  // На Mac в fullscreen modal вызывает краш — используем просто новое окно
  const isFullScreen = IS_MAC && parentWin && parentWin.isFullScreen();

  browserWindow = new BrowserWindow({
    width: 850,
    height: 650,
    show: true,
    movable: true,
    resizable: true,
    // modal блокирует главное окно пока открыт проводник (только не в fullscreen)
    parent: parentWin && !isFullScreen ? parentWin : undefined,
    modal: !isFullScreen && !!parentWin,
    titleBarStyle: IS_MAC ? 'hiddenInset' : 'default',
    title: 'Select Music Folder',
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      sandbox: false,
    },
  });

  browserWindow.loadFile(tmpPath);

  browserWindow.webContents.once('did-finish-load', () => {
    try { fss.unlinkSync(tmpPath); } catch {}
  });

  browserWindow.on('closed', () => {
    for (const [, watcher] of dirWatchers) { try { watcher.close(); } catch(e) {} }
    dirWatchers.clear();
    browserWindow = null;
    if (resolvePromise) { resolvePromise(null); resolvePromise = null; }
  });

  return new Promise((resolve) => {
    resolvePromise = (result) => {
      resolvePromise = null;
      resolve(result);
    };
  });
}

module.exports = { createFolderBrowser };
