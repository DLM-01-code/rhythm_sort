// Electron main process — desktop wrapper for Sortify
const { app, BrowserWindow, ipcMain, dialog, shell } = require("electron");
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
    titleBarStyle: process.platform === "darwin" ? "hiddenInset" : "default",
    icon: path.join(__dirname, "../build/icon.ico"),
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  if (isDev) {
    const devUrl = "http://localhost:8080";
    console.log(`🔧 Trying to load: ${devUrl}`);
    
    mainWindow.loadURL(devUrl).catch((err) => {
      console.error(`❌ Failed to load ${devUrl}:`, err.message);
      mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`<h1>Error: ${err.message}</h1>`)}`);
    });
  } else {
    // Production build - правильные пути
    let indexPath = "";
    
    // Пробуем разные возможные пути
    const possiblePaths = [
      path.join(__dirname, "../dist/index.html"),
      path.join(process.resourcesPath, "dist/index.html"),
      path.join(process.resourcesPath, "app.asar", "dist", "index.html"),
      path.join(__dirname, "../dist/client/index.html"),
    ];
    
    for (const p of possiblePaths) {
      if (fs.existsSync(p)) {
        indexPath = p;
        console.log(`✅ Found index.html at: ${indexPath}`);
        break;
      }
    }
    
    if (indexPath) {
      mainWindow.loadFile(indexPath).catch(err => {
        console.error("❌ Failed to load file:", err);
        showErrorWindow(mainWindow, err.message);
      });
    } else {
      console.error("❌ Could not find index.html in any path!");
      showErrorWindow(mainWindow, "Could not find index.html");
    }
  }

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error(`❌ Failed to load: ${errorDescription} (${errorCode})`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    console.log('✅ Page loaded successfully');
  });
}

function showErrorWindow(window, errorMessage) {
  window.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(`
    <html>
      <head><title>Error</title></head>
      <body style="background:#1a1d24;color:white;display:flex;align-items:center;justify-content:center;height:100vh;font-family:monospace;flex-direction:column;">
        <h1>❌ Failed to load application</h1>
        <p>${errorMessage}</p>
        <p>__dirname: ${__dirname}</p>
        <p>resourcesPath: ${process.resourcesPath}</p>
        <p>isPackaged: ${app.isPackaged}</p>
      </body>
    </html>
  `)}`);
}

app.whenReady().then(() => {
  console.log('🚀 App is ready');
  console.log('📦 isPackaged:', app.isPackaged);
  console.log('📁 __dirname:', __dirname);
  console.log('📁 resourcesPath:', process.resourcesPath);
  
  createWindow();
  registerIpcHandlers();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

function decodeFileName(str) {
  try {
    if (str.includes('%')) {
      return decodeURIComponent(str);
    }
  } catch (e) {}
  return str;
}

function registerIpcHandlers() {
  ipcMain.handle("dialog:selectFolder", async () => {
    console.log('📁 selectFolder called');
    const r = await dialog.showOpenDialog({ properties: ["openDirectory"] });
    if (r.canceled || r.filePaths.length === 0) return null;
    console.log('📁 Selected folder:', r.filePaths[0]);
    return r.filePaths[0];
  });

  ipcMain.handle("dialog:selectFolderWithPreview", async () => {
    console.log('📁 Custom folder browser with preview called');
    try {
      const { createFolderBrowser } = await import('./folderBrowser.cjs');
      const selectedFolder = await createFolderBrowser();
      console.log('📁 Selected folder:', selectedFolder);
      return selectedFolder;
    } catch (err) {
      console.error('Error in folder browser:', err);
      return null;
    }
  });

  ipcMain.handle("dialog:selectFiles", async () => {
    console.log('🎵 selectFiles called');
    const result = await dialog.showOpenDialog({
      properties: ["openFile", "multiSelections"],
      filters: [
        { name: "Audio Files", extensions: Array.from(AUDIO_EXTS) },
        { name: "All Files", extensions: ["*"] }
      ]
    });

    if (result.canceled || result.filePaths.length === 0) return null;
    console.log('🎵 Selected files:', result.filePaths);

    const files = [];
    for (const filePath of result.filePaths) {
      const ext = path.extname(filePath).slice(1).toLowerCase();
      if (AUDIO_EXTS.has(ext)) {
        const stat = await fsp.stat(filePath);
        files.push({
          path: filePath,
          name: path.basename(filePath),
          size: stat.size,
          ext: ext
        });
      }
    }
    return files;
  });

  ipcMain.handle("fs:checkFile", async (_e, filePath) => {
    try {
      const stats = await fsp.stat(filePath);
      if (stats.size === 0) {
        console.log(`❌ Empty file: ${path.basename(filePath)}`);
        return false;
      }
      console.log(`✅ File exists: ${path.basename(filePath)} (${stats.size} bytes)`);
      return true;
    } catch (err) {
      console.error(`❌ File check failed: ${path.basename(filePath)}`, err.message);
      return false;
    }
  });

  ipcMain.handle("fs:checkFolderExists", async (_e, folderPath) => {
    try {
      await fsp.access(folderPath);
      return true;
    } catch {
      return false;
    }
  });

  ipcMain.handle("fs:getDroppedPath", async (_e, filePath) => {
    try {
      console.log('Getting path for:', filePath);
      const stats = await fsp.stat(filePath);
      if (stats.isDirectory()) {
        return filePath;
      }
      return path.dirname(filePath);
    } catch (err) {
      console.error('Error getting path:', err);
      return null;
    }
  });

  ipcMain.handle("fs:getDesktopPath", async () => {
    const desktopPath = path.join(os.homedir(), 'Desktop');
    console.log('🖥️ Desktop path:', desktopPath);
    return desktopPath;
  });

  ipcMain.handle("fs:getFileUrl", async (_e, filePath) => {
    try {
      let decodedPath = filePath;
      try {
        decodedPath = decodeURIComponent(filePath);
      } catch(e) {}
      decodedPath = path.normalize(decodedPath);
      return `file://${decodedPath}`;
    } catch (err) {
      console.error('Error getting file URL:', err);
      return null;
    }
  });

  ipcMain.handle("fs:renameFile", async (_e, oldPath, newNameWithoutExt) => {
    try {
      const dir = path.dirname(oldPath);
      const ext = path.extname(oldPath);
      const newPath = path.join(dir, newNameWithoutExt + ext);
      
      const exists = await fsp.access(newPath).then(() => true).catch(() => false);
      if (exists) {
        return { ok: false, error: "File already exists" };
      }
      
      await fsp.rename(oldPath, newPath);
      return { ok: true, newPath };
    } catch (err) {
      console.error('Failed to rename file:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle("fs:readTags", async (_e, filePath) => {
    try {
      const tags = NodeID3.read(filePath);
      return {
        title: tags.title,
        artist: tags.artist,
        album: tags.album,
        year: tags.year,
        genre: tags.genre,
        cover: tags.image ? {
          mime: tags.image.mime,
          type: tags.image.type,
          description: tags.image.description,
          imageBuffer: tags.image.imageBuffer.toString('base64')
        } : null
      };
    } catch (err) {
      console.error('Failed to read tags:', err);
      return null;
    }
  });

  ipcMain.handle("fs:updateTitle", async (_e, filePath, newTitle) => {
    try {
      const tags = NodeID3.read(filePath);
      tags.title = newTitle;
      const success = NodeID3.update(tags, filePath);
      return { ok: success };
    } catch (err) {
      console.error('Failed to update title:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle("fs:updateCover", async (_e, filePath, coverBase64) => {
    try {
      const tags = NodeID3.read(filePath);
      if (coverBase64) {
        const imageBuffer = Buffer.from(coverBase64.split(',')[1] || coverBase64, 'base64');
        tags.image = {
          mime: 'image/jpeg',
          type: {
            id: 3,
            name: 'front cover'
          },
          description: 'Cover',
          imageBuffer: imageBuffer
        };
      } else {
        tags.image = null;
      }
      const success = NodeID3.update(tags, filePath);
      return { ok: success };
    } catch (err) {
      console.error('Failed to update cover:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle("fs:updateCoverOnAccept", async (_e, targetFolder, fileName, coverBase64) => {
    try {
      const destPath = path.join(targetFolder, fileName);
      const tags = NodeID3.read(destPath);
      if (coverBase64) {
        const imageBuffer = Buffer.from(coverBase64.split(',')[1] || coverBase64, 'base64');
        tags.image = {
          mime: 'image/jpeg',
          type: {
            id: 3,
            name: 'front cover'
          },
          description: 'Cover',
          imageBuffer: imageBuffer
        };
      } else {
        tags.image = null;
      }
      const success = NodeID3.update(tags, destPath);
      return { ok: success };
    } catch (err) {
      console.error('Failed to update cover on accept:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle("fs:saveBrokenList", async (_e, folderPath, brokenFiles) => {
    try {
      const fileName = "Broken Files.txt";
      const filePath = path.join(folderPath, fileName);
      
      const content = [
        `Sortify - Broken Files Report`,
        `===============================`,
        `Folder: ${folderPath}`,
        `Date: ${new Date().toLocaleString()}`,
        `Total broken files: ${brokenFiles.length}`,
        ``,
        `List of broken files:`,
        `---------------------`,
        ...brokenFiles.map((f, i) => `${i + 1}. ${f.name}`)
      ].join('\n');
      
      await fsp.writeFile(filePath, content, 'utf-8');
      console.log(`✅ Broken files saved to: ${filePath} (${brokenFiles.length} files)`);
      return { ok: true, filePath };
    } catch (err) {
      console.error('Failed to save broken list:', err);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle("fs:scanFolder", async (_e, folder) => {
    console.log('🔍 Scanning folder (ONE TIME ONLY):', folder);
    const out = [];

    const skipFiles = new Set([
      'Thumbs.db', 'desktop.ini'
    ]);

    function shouldSkipFile(name) {
      if (skipFiles.has(name)) return true;
      return false;
    }

    async function* walk(dir) {
      let entries;
      try { entries = await fsp.readdir(dir, { withFileTypes: true }); }
      catch { return; }
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          yield* walk(full);
        } else if (!shouldSkipFile(e.name)) {
          yield full;
        }
      }
    }

    let fileCount = 0;
    for await (const file of walk(folder)) {
      const ext = path.extname(file).slice(1).toLowerCase();
      const fileName = path.basename(file);
      
      try {
        const stat = await fsp.stat(file);
        out.push({
          path: file,
          name: fileName,
          size: stat.size,
          ext: ext || 'unknown'
        });
        fileCount++;
        console.log(`📄 [${fileCount}] Found: ${fileName} (${ext || 'no extension'})`);
      } catch (err) {
        console.error(`❌ Error reading file: ${fileName}`, err);
      }
    }
    
    console.log(`📊 SUMMARY: Found ${out.length} total files in ${folder}`);
    
    return out;
  });

  ipcMain.handle("fs:readFile", async (_e, p) => {
    try {
      let filePath = p;
      try {
        filePath = decodeURIComponent(p);
      } catch(e) {
        filePath = p;
      }

      filePath = path.normalize(filePath);

      console.log('📖 Reading file:', path.basename(filePath));
      const buf = await fsp.readFile(filePath);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    } catch (err) {
      console.error('❌ Error reading file:', err);
      throw err;
    }
  });

  ipcMain.handle("fs:accept", async (_e, src, targetFolder, mode) => {
    const fileName = path.basename(src);
    console.log(`✅ Accepting track: ${fileName} -> ${mode} to ${targetFolder}`);
    try {
      const folderExists = await fsp.access(targetFolder).then(() => true).catch(() => false);
      
      if (!folderExists) {
        console.log(`❌ Target folder does not exist: ${targetFolder}`);
        return { ok: false, error: "Target folder does not exist. Please select a valid folder." };
      }

      const dest = path.join(targetFolder, fileName);
      const fileExists = await fsp.access(dest).then(() => true).catch(() => false);

      if (fileExists) {
        console.log(`⚠️ File already exists, skipping: ${fileName}`);
        return { ok: true, skipped: true, message: "File already exists" };
      }

      if (mode === "move") {
        await fsp.rename(src, dest).catch(async () => {
          await fsp.copyFile(src, dest);
          await fsp.unlink(src);
        });
        console.log(`✅ Moved to: ${dest}`);
      } else {
        await fsp.copyFile(src, dest);
        console.log(`✅ Copied to: ${dest}`);
      }
      return { ok: true, skipped: false };
    } catch (err) {
      console.error('❌ Accept error:', err);
      return { ok: false, error: String(err && err.message || err) };
    }
  });

  ipcMain.handle("fs:reject", async (_e, src, mode, rejectedFolder) => {
    console.log(`⏭️ Skipping track: ${path.basename(src)}`);
    return { ok: true };
  });

  // ✅ Чтение ПОЛНЫХ тегов (все поля)
  ipcMain.handle("fs:readFullTags", async (_e, filePath) => {
    try {
      const tags = NodeID3.read(filePath);
      if (!tags || tags === false) return null;
      return {
        title: tags.title || "",
        artist: tags.artist || "",
        album: tags.album || "",
        year: tags.year || "",
        genre: tags.genre || "",
        trackNumber: tags.trackNumber || "",
        comment: tags.comment?.text || "",
        albumArtist: tags.performerInfo || "",
        composer: tags.composer || "",
        discNumber: tags.partOfSet || "",
        bpm: tags.bpm || "",
        initialKey: tags.initialKey || "",
      };
    } catch (err) {
      console.error("Failed to read full tags:", err);
      return null;
    }
  });

  // ✅ Запись ПОЛНЫХ тегов
  ipcMain.handle("fs:writeFullTags", async (_e, filePath, tagData) => {
    try {
      const ext = path.extname(filePath).slice(1).toLowerCase();
      if (!["mp3", "mp2", "mpa", "mpga", "m4a", "m4b"].includes(ext)) {
        return { ok: false, error: "Format does not support ID3 tags" };
      }
      const existingTags = NodeID3.read(filePath) || {};
      const updatedTags = {
        ...existingTags,
        title: tagData.title ?? existingTags.title,
        artist: tagData.artist ?? existingTags.artist,
        album: tagData.album ?? existingTags.album,
        year: tagData.year ?? existingTags.year,
        genre: tagData.genre ?? existingTags.genre,
        trackNumber: tagData.trackNumber ?? existingTags.trackNumber,
        comment: tagData.comment ? { language: "eng", text: tagData.comment } : existingTags.comment,
        performerInfo: tagData.albumArtist ?? existingTags.performerInfo,
        composer: tagData.composer ?? existingTags.composer,
        partOfSet: tagData.discNumber ?? existingTags.partOfSet,
        bpm: tagData.bpm ?? existingTags.bpm,
        initialKey: tagData.initialKey ?? existingTags.initialKey,
      };
      const success = NodeID3.update(updatedTags, filePath);
      return { ok: !!success };
    } catch (err) {
      console.error("Failed to write full tags:", err);
      return { ok: false, error: err.message };
    }
  });

  // ✅ Анализ BPM через music-tempo
  ipcMain.handle("fs:analyzeBpm", async (_e, filePath) => {
    try {
      const MusicTempo = require("music-tempo");
      const AudioContext = require("web-audio-api").AudioContext;
      const ctx = new AudioContext();
      const buf = await fsp.readFile(filePath);
      const audioBuffer = await new Promise((resolve, reject) => {
        ctx.decodeAudioData(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), resolve, reject);
      });
      const channelData = audioBuffer.getChannelData(0);
      const mt = new MusicTempo(channelData);
      const bpm = Math.round(mt.tempo);
      ctx.close();
      console.log(`🎵 BPM analyzed: ${bpm} for ${path.basename(filePath)}`);
      return { ok: true, bpm: String(bpm) };
    } catch (err) {
      console.error("BPM analysis failed:", err.message);
      return { ok: false, error: err.message };
    }
  });

  // ✅ Анализ тональности через @tonaljs/tonal
  ipcMain.handle("fs:analyzeKey", async (_e, filePath) => {
    try {
      // Простой анализ через хроматограмму (Krumhansl-Schmuckler)
      const AudioContext = require("web-audio-api").AudioContext;
      const ctx = new AudioContext();
      const buf = await fsp.readFile(filePath);
      const audioBuffer = await new Promise((resolve, reject) => {
        ctx.decodeAudioData(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength), resolve, reject);
      });
      const channelData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      
      // Профили Кромхансла-Шмакера
      const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
      const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
      const noteNames = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
      
      // Вычисляем хроматограмму
      const chroma = new Array(12).fill(0);
      const step = Math.floor(sampleRate / 12);
      for (let i = 0; i < Math.min(channelData.length, sampleRate * 30); i++) {
        const noteIndex = Math.floor((i / step)) % 12;
        chroma[noteIndex] += Math.abs(channelData[i]);
      }
      
      // Нормализация
      const maxChroma = Math.max(...chroma);
      const normChroma = chroma.map(v => maxChroma > 0 ? v / maxChroma : 0);
      
      // Корреляция с профилями
      let bestScore = -Infinity;
      let bestKey = "C";
      let bestMode = "major";
      
      for (let root = 0; root < 12; root++) {
        let majorScore = 0, minorScore = 0;
        for (let i = 0; i < 12; i++) {
          majorScore += normChroma[(i + root) % 12] * majorProfile[i];
          minorScore += normChroma[(i + root) % 12] * minorProfile[i];
        }
        if (majorScore > bestScore) { bestScore = majorScore; bestKey = noteNames[root]; bestMode = "major"; }
        if (minorScore > bestScore) { bestScore = minorScore; bestKey = noteNames[root]; bestMode = "minor"; }
      }
      
      // Перевод в Camelot/Open Key нотацию
      const camelotMap = {
        "C major": "8B", "G major": "9B", "D major": "10B", "A major": "11B",
        "E major": "12B", "B major": "1B", "F# major": "2B", "C# major": "3B",
        "G# major": "4B", "D# major": "5B", "A# major": "6B", "F major": "7B",
        "A minor": "8A", "E minor": "9A", "B minor": "10A", "F# minor": "11A",
        "C# minor": "12A", "G# minor": "1A", "D# minor": "2A", "A# minor": "3A",
        "F minor": "4A", "C minor": "5A", "G minor": "6A", "D minor": "7A",
      };
      const keyString = `${bestKey} ${bestMode}`;
      const camelot = camelotMap[keyString] || keyString;
      
      ctx.close();
      console.log(`🎼 Key analyzed: ${keyString} (${camelot}) for ${path.basename(filePath)}`);
      return { ok: true, key: camelot, keyFull: keyString };
    } catch (err) {
      console.error("Key analysis failed:", err.message);
      return { ok: false, error: err.message };
    }
  });

  // ✅ Пакетное переименование по шаблону
  ipcMain.handle("fs:batchRename", async (_e, filePath, template) => {
    try {
      const tags = NodeID3.read(filePath);
      if (!tags || tags === false) return { ok: false, error: "Cannot read tags" };
      
      const ext = path.extname(filePath);
      const dir = path.dirname(filePath);
      
      let newName = template
        .replace("{Title}", tags.title || "Unknown")
        .replace("{Artist}", tags.artist || "Unknown")
        .replace("{Album}", tags.album || "Unknown")
        .replace("{Year}", tags.year || "")
        .replace("{Genre}", tags.genre || "")
        .replace("{BPM}", tags.bpm || "000")
        .replace("{Key}", tags.initialKey || "")
        .replace("{TrackNumber}", tags.trackNumber || "");
      
      // Убираем недопустимые символы
      newName = newName.replace(/[<>:"/\\|?*]/g, "_").trim();
      
      const newPath = path.join(dir, newName + ext);
      const exists = await fsp.access(newPath).then(() => true).catch(() => false);
      if (exists && newPath !== filePath) {
        return { ok: false, error: "File already exists" };
      }
      
      await fsp.rename(filePath, newPath);
      return { ok: true, newPath, newName: newName + ext };
    } catch (err) {
      console.error("Batch rename failed:", err);
      return { ok: false, error: err.message };
    }
  });

}