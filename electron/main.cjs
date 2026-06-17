// Electron main process — Rhythm Sort (Windows)
const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require("electron");
const path = require("path");
const fs = require("fs");
const fsp = fs.promises;
const os = require("os");
const NodeID3 = require('node-id3');

const AUDIO_EXTS = new Set([
  "mp3", "wav", "flac", "aac", "ogg", "m4a", "m4b", "m4r", "m4p",
  "mp4", "mpeg", "mpga", "mp2", "mpa", "opus", "wma", "wmv",
  "aiff", "aif", "aifc", "caf", "alac", "ape", "dsf", "dff",
  "dvf", "gsm", "ircam", "m3u", "m4r", "mka", "mlp", "ra", "rm",
  "snd", "tak", "tta", "voc", "vox", "wv"
]);

const isDev = !app.isPackaged;
let mainWindow = null;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: "#1a1d24",
    icon: path.join(__dirname, "../build/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  // Windows: убираем меню
  Menu.setApplicationMenu(null);

  if (isDev) {
    mainWindow.webContents.openDevTools();
    const devUrl = "http://localhost:8080";
    console.log(`🔧 Trying to load: ${devUrl}`);
    mainWindow.loadURL(devUrl).catch((err) => {
      console.error(`❌ Failed to load ${devUrl}:`, err.message);
      showErrorWindow(mainWindow, err.message);
    });
  } else {
    const possiblePaths = [
      path.join(__dirname, "../dist/index.html"),
      path.join(process.resourcesPath, "dist/index.html"),
      path.join(process.resourcesPath, "app.asar", "dist", "index.html"),
    ];
    const indexPath = possiblePaths.find(p => fs.existsSync(p));
    if (indexPath) {
      console.log(`✅ Found index.html at: ${indexPath}`);
      mainWindow.loadFile(indexPath).catch(err => showErrorWindow(mainWindow, err.message));
    } else {
      console.error("❌ Could not find index.html!");
      showErrorWindow(mainWindow, "Could not find index.html");
    }
  }

  mainWindow.webContents.on('did-fail-load', (e, code, desc) => {
    console.error(`❌ Failed to load: ${desc} (${code})`);
  });
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Page loaded successfully');
  });
}

function showErrorWindow(window, errorMessage) {
  window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <html><head><title>Error</title></head>
    <body style="background:#1a1d24;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:monospace;flex-direction:column;">
      <h1>❌ Failed to load application</h1>
      <p>${errorMessage}</p>
      <p>__dirname: ${__dirname} | isPackaged: ${app.isPackaged}</p>
    </body></html>
  `)}`);
}

app.whenReady().then(() => {
  console.log('🚀 App is ready | platform:', process.platform, '| packaged:', app.isPackaged);
  createWindow();
  registerIpcHandlers();
});

app.on("window-all-closed", () => { app.quit(); });

function decodeFileName(str) {
  try { if (str.includes('%')) return decodeURIComponent(str); } catch (e) {}
  return str;
}

function registerIpcHandlers() {

  ipcMain.handle("dialog:selectFolder", async () => {
    const r = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (r.canceled || !r.filePaths.length) return null;
    return r.filePaths[0];
  });

  // ВАЖНО: require() вместо await import() для совместимости
  ipcMain.handle("dialog:selectFolderWithPreview", async (_e, startPath, mode = 'source') => {
    console.log('📁 selectFolderWithPreview called, mode:', mode, 'startPath:', startPath);
    try {
      const { createFolderBrowser } = require("./folderBrowser.cjs");
      const selectedFolder = await createFolderBrowser(startPath || null, mode);
      console.log('📁 Selected folder:', selectedFolder);
      return selectedFolder;
    } catch (err) {
      console.error('📁 Folder browser error:', err);
      return null;
    }
  });

  ipcMain.handle("dialog:selectFiles", async () => {
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Audio Files", extensions: Array.from(AUDIO_EXTS) },
        { name: "All Files", extensions: ["*"] }
      ]
    });
    if (result.canceled || !result.filePaths.length) return null;
    const files = [];
    for (const filePath of result.filePaths) {
      const ext = path.extname(filePath).slice(1).toLowerCase();
      if (AUDIO_EXTS.has(ext)) {
        const stat = await fsp.stat(filePath);
        files.push({ path: filePath, name: path.basename(filePath), size: stat.size, extension: ext });
      }
    }
    return files;
  });

  ipcMain.handle("fs:checkFile", async (_e, filePath) => {
    try {
      const stats = await fsp.stat(filePath);
      return stats.size > 0;
    } catch { return false; }
  });

  ipcMain.handle("fs:checkFolderExists", async (_e, folderPath) => {
    try { await fsp.access(folderPath); return true; }
    catch { return false; }
  });

  // ✅ getFileInfo — нужен для useTrackUrl (большие файлы > 50MB)
  ipcMain.handle("fs:getFileInfo", async (_e, filePath) => {
    try {
      const stat = await fsp.stat(filePath);
      return { size: stat.size, isFile: stat.isFile(), birthtime: stat.birthtime, mtime: stat.mtime };
    } catch { return { size: 0, isFile: false, birthtime: new Date(), mtime: new Date() }; }
  });

  ipcMain.handle("fs:getDroppedPath", async (_e, filePath) => {
    try {
      const stats = await fsp.stat(filePath);
      return stats.isDirectory() ? filePath : path.dirname(filePath);
    } catch { return null; }
  });

  ipcMain.handle("fs:getDesktopPath", async () => {
    return path.join(os.homedir(), 'Desktop');
  });

  ipcMain.handle("fs:getFileUrl", async (_e, filePath) => {
    try {
      let p = filePath;
      try { p = decodeURIComponent(filePath); } catch {}
      p = path.normalize(p);
      // Windows: file:///C:/path
      return `file:///${p.replace(/\\/g, '/')}`;
    } catch { return null; }
  });

  ipcMain.handle("fs:renameFile", async (_e, oldPath, newNameWithoutExt) => {
    try {
      const dir = path.dirname(oldPath);
      const ext = path.extname(oldPath);
      const newPath = path.join(dir, newNameWithoutExt + ext);
      const exists = await fsp.access(newPath).then(() => true).catch(() => false);
      if (exists) return { ok: false, error: "File already exists" };
      await fsp.rename(oldPath, newPath);
      return { ok: true, newPath };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle("fs:readTags", async (_e, filePath) => {
    try {
      const tags = NodeID3.read(filePath);
      if (!tags || tags === false) return null;
      return {
        title: tags.title, artist: tags.artist, album: tags.album,
        year: tags.year, genre: tags.genre,
        cover: tags.image ? {
          mime: tags.image.mime, type: tags.image.type,
          description: tags.image.description,
          imageBuffer: tags.image.imageBuffer.toString('base64')
        } : null
      };
    } catch { return null; }
  });

  ipcMain.handle("fs:updateTitle", async (_e, filePath, newTitle) => {
    try {
      const tags = NodeID3.read(filePath);
      if (!tags || tags === false) return { ok: true };
      tags.title = newTitle;
      return { ok: !!NodeID3.update(tags, filePath) };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle("fs:updateCover", async (_e, filePath, coverBase64) => {
    try {
      const tags = NodeID3.read(filePath);
      if (!tags || tags === false) return { ok: true };
      tags.image = coverBase64
        ? { mime: 'image/jpeg', type: { id: 3, name: 'front cover' }, description: 'Cover',
            imageBuffer: Buffer.from(coverBase64.split(',')[1] || coverBase64, 'base64') }
        : null;
      return { ok: !!NodeID3.update(tags, filePath) };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle("fs:updateCoverOnAccept", async (_e, targetFolder, fileName, coverBase64) => {
    try {
      const destPath = path.join(targetFolder, fileName);
      const tags = NodeID3.read(destPath);
      if (!tags || tags === false) return { ok: true };
      tags.image = coverBase64
        ? { mime: 'image/jpeg', type: { id: 3, name: 'front cover' }, description: 'Cover',
            imageBuffer: Buffer.from(coverBase64.split(',')[1] || coverBase64, 'base64') }
        : null;
      return { ok: !!NodeID3.update(tags, destPath) };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle("fs:readFullTags", async (_e, filePath) => {
    try {
      const tags = NodeID3.read(filePath);
      if (!tags || tags === false) return null;
      return {
        title: tags.title || '', artist: tags.artist || '',
        album: tags.album || '', year: tags.year || '',
        genre: tags.genre || '', trackNumber: tags.trackNumber || '',
        discNumber: tags.partOfSet || '', albumArtist: tags.performerInfo || '',
        composer: tags.composer || '',
        comment: typeof tags.comment === 'object' ? (tags.comment?.text || '') : (tags.comment || ''),
        bpm: tags.bpm || '', key: tags.initialKey || '',
        cover: tags.image ? {
          mime: tags.image.mime, type: tags.image.type,
          description: tags.image.description,
          imageBuffer: tags.image.imageBuffer.toString('base64')
        } : null
      };
    } catch { return null; }
  });

  ipcMain.handle("fs:writeFullTags", async (_e, filePath, tagData) => {
    try {
      const existing = NodeID3.read(filePath) || {};
      const updated = {
        ...existing,
        title:         tagData.title         !== undefined ? tagData.title         : existing.title,
        artist:        tagData.artist        !== undefined ? tagData.artist        : existing.artist,
        album:         tagData.album         !== undefined ? tagData.album         : existing.album,
        year:          tagData.year          !== undefined ? tagData.year          : existing.year,
        genre:         tagData.genre         !== undefined ? tagData.genre         : existing.genre,
        trackNumber:   tagData.trackNumber   !== undefined ? tagData.trackNumber   : existing.trackNumber,
        partOfSet:     tagData.discNumber    !== undefined ? tagData.discNumber    : existing.partOfSet,
        performerInfo: tagData.albumArtist   !== undefined ? tagData.albumArtist   : existing.performerInfo,
        composer:      tagData.composer      !== undefined ? tagData.composer      : existing.composer,
        bpm:           tagData.bpm           !== undefined ? tagData.bpm           : existing.bpm,
        initialKey:    tagData.key           !== undefined ? tagData.key           : existing.initialKey,
      };
      if (tagData.comment !== undefined) updated.comment = { language: 'eng', text: tagData.comment };
      return { ok: !!NodeID3.update(updated, filePath) };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle("fs:analyzeBpm", async (_e, filePath) => {
    try {
      const { execSync } = require('child_process');
      const tmpPath = path.join(os.tmpdir(), 'rhythmsort_bpm.raw');
      execSync(`ffmpeg -y -i "${filePath}" -f f32le -ar 44100 -ac 1 "${tmpPath}" 2>NUL`, { timeout: 30000 });
      const rawBuf = fs.readFileSync(tmpPath);
      const float32 = new Float32Array(rawBuf.buffer, rawBuf.byteOffset, rawBuf.byteLength / 4);
      const MusicTempo = require('music-tempo');
      const mt = new MusicTempo(float32);
      const bpm = Math.round(mt.tempo);
      try { fs.unlinkSync(tmpPath); } catch {}
      return { bpm };
    } catch (e) {
      console.warn('BPM analysis failed:', e.message);
      return { bpm: null };
    }
  });

  ipcMain.handle("fs:analyzeKey", async (_e, filePath) => {
    try {
      const existing = NodeID3.read(filePath);
      if (existing?.initialKey) return { key: existing.initialKey };
      return { key: null };
    } catch { return { key: null }; }
  });

  ipcMain.handle("fs:batchRename", async (_e, filePath, template) => {
    try {
      const tags = NodeID3.read(filePath) || {};
      const dir = path.dirname(filePath);
      const ext = path.extname(filePath);
      let newName = template
        .replace('{Title}',  tags.title || '')
        .replace('{Artist}', tags.artist || '')
        .replace('{Album}',  tags.album || '')
        .replace('{Year}',   tags.year || '')
        .replace('{Genre}',  tags.genre || '')
        .replace('{BPM}',    tags.bpm || '')
        .replace('{Key}',    tags.initialKey || '')
        .replace(/[<>:"/\\|?*]/g, '_')
        .trim();
      if (!newName) return { ok: false, error: 'Empty name after template' };
      const newPath = path.join(dir, newName + ext);
      if (newPath === filePath) return { ok: true, newPath };
      const exists = await fsp.access(newPath).then(() => true).catch(() => false);
      if (exists) return { ok: false, error: 'File already exists' };
      await fsp.rename(filePath, newPath);
      return { ok: true, newPath };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle("fs:saveBrokenList", async (_e, folderPath, brokenFiles) => {
    try {
      const filePath = path.join(folderPath, "Broken Files.txt");
      const content = [
        `Sortify - Broken Files Report`, `===============================`,
        `Folder: ${folderPath}`, `Date: ${new Date().toLocaleString()}`,
        `Total broken files: ${brokenFiles.length}`, ``,
        `List of broken files:`, `---------------------`,
        ...brokenFiles.map((f, i) => `${i + 1}. ${f.name}`)
      ].join('\n');
      await fsp.writeFile(filePath, content, 'utf-8');
      return { ok: true, filePath };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  ipcMain.handle("fs:scanFolder", async (_e, folder) => {
    console.log('🔍 Scanning folder:', folder);
    const out = [];
    const skipFiles = new Set(['Thumbs.db', 'desktop.ini']);

    async function* walk(dir) {
      let entries;
      try { entries = await fsp.readdir(dir, { withFileTypes: true }); }
      catch { return; }
      for (const e of entries) {
        if (skipFiles.has(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) yield* walk(full);
        else yield full;
      }
    }

    for await (const file of walk(folder)) {
      const ext = path.extname(file).slice(1).toLowerCase();
      if (!ext || !AUDIO_EXTS.has(ext)) continue;
      try {
        const stat = await fsp.stat(file);
        out.push({ path: file, name: path.basename(file), size: stat.size, extension: ext });
      } catch (err) { console.error(`❌ Error reading: ${path.basename(file)}`, err.message); }
    }
    console.log(`📊 Found ${out.length} audio files`);
    return out;
  });

  ipcMain.handle("fs:readFile", async (_e, p) => {
    try {
      let filePath = p;
      try { filePath = decodeURIComponent(p); } catch {}
      filePath = path.normalize(filePath);
      const buf = await fsp.readFile(filePath);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    } catch (err) {
      console.error('❌ Error reading file:', err);
      throw err;
    }
  });

  // ✅ AIFF → WAV конвертация через ffmpeg
  // Chromium (Electron) не умеет декодировать AIFF в <audio>, поэтому
  // для .aif/.aiff/.aifc конвертируем в WAV на лету и отдаём результат
  ipcMain.handle("fs:readAudioForPlayback", async (_e, p) => {
    try {
      let filePath = p;
      try { filePath = decodeURIComponent(p); } catch {}
      filePath = path.normalize(filePath);

      const ext = path.extname(filePath).slice(1).toLowerCase();
      const needsConversion = ext === 'aif' || ext === 'aiff' || ext === 'aifc';

      if (!needsConversion) {
        const buf = await fsp.readFile(filePath);
        return { buffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), ext };
      }

      // Конвертируем AIFF → WAV через ffmpeg во временный файл
      const { execFile } = require('child_process');
      const tmpPath = path.join(os.tmpdir(), `rhythmsort_play_${Date.now()}_${Math.random().toString(36).slice(2)}.wav`);

      await new Promise((resolve, reject) => {
        execFile('ffmpeg', ['-y', '-i', filePath, '-c:a', 'pcm_s16le', tmpPath], { timeout: 30000 }, (err) => {
          if (err) reject(err); else resolve(null);
        });
      });

      const buf = await fsp.readFile(tmpPath);
      const arrayBuf = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      try { fs.unlinkSync(tmpPath); } catch {}

      console.log(`✅ Converted AIFF → WAV for playback: ${path.basename(filePath)}`);
      return { buffer: arrayBuf, ext: 'wav' };
    } catch (err) {
      console.error('❌ AIFF conversion failed, falling back to raw read:', err.message);
      // Fallback: пробуем отдать как есть (может не воспроизвестись, но хотя бы не упадёт)
      try {
        let filePath = p;
        try { filePath = decodeURIComponent(p); } catch {}
        filePath = path.normalize(filePath);
        const buf = await fsp.readFile(filePath);
        const ext = path.extname(filePath).slice(1).toLowerCase();
        return { buffer: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), ext };
      } catch (err2) {
        throw err2;
      }
    }
  });

  ipcMain.handle("fs:accept", async (_e, src, targetFolder, mode) => {
    const fileName = path.basename(src);
    try {
      const folderExists = await fsp.access(targetFolder).then(() => true).catch(() => false);
      if (!folderExists) return { ok: false, error: "Target folder does not exist." };
      const dest = path.join(targetFolder, fileName);
      const fileExists = await fsp.access(dest).then(() => true).catch(() => false);
      if (fileExists) return { ok: true, skipped: true };
      if (mode === "move") {
        await fsp.rename(src, dest).catch(async () => {
          await fsp.copyFile(src, dest);
          await fsp.unlink(src);
        });
      } else {
        await fsp.copyFile(src, dest);
      }
      return { ok: true, skipped: false };
    } catch (err) {
      console.error('❌ Accept error:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle("fs:reject", async (_e, src, mode, rejectedFolder) => {
    try {
      if (mode === "move" && rejectedFolder) {
        const dest = path.join(rejectedFolder, path.basename(src));
        const folderOk = await fsp.access(rejectedFolder).then(() => true).catch(() => false);
        if (folderOk) {
          await fsp.rename(src, dest).catch(async () => {
            await fsp.copyFile(src, dest);
            await fsp.unlink(src);
          });
        }
      }
      return { ok: true };
    } catch (err) { return { ok: false, error: err.message }; }
  });

  // folder-browser:trash-folder и folder-browser:delete-folder
  // регистрируются внутри folderBrowser.cjs — не дублируем здесь
}
