# English

# 🎵 Rhythm Sort — Your Personal Music Sorter

Rhythm Sort is a Windows/Mac program that helps you organize large music collections. You listen to tracks one by one and decide what to do with them — keep, skip, or send to a specific folder. Everything is controlled via keyboard, with no extra mouse clicks.

---

## 📦 Installation

1. Download the `.exe` installer file (Windows) or `.dmg` file (Mac)
2. Run it and click "Next" (Windows) or drag the app into Applications (Mac)
3. After installation, open **Rhythm Sort** from your desktop

> **Mac users:** on first launch, macOS may show an "unidentified developer" warning since the app isn't code-signed. Right-click the app and choose **Open** to bypass this — you only need to do it once.

---

## 🚀 How to Get Started

### 1. Choose Your Music Folder
Click the big **Source Folder** button — a file browser will open. Find your folder with tracks and click **Select This Folder**. The app will automatically find all music files inside, even if they're in subfolders.

### 2. Choose Where to Save Liked Tracks
Click **Target Folder** and select or create a folder where accepted tracks will be sent.

### 3. Listen and Sort
The first track will start playing automatically. From there, it's simple:

| Action | Key |
|---|---|
| ✅ Accept track — copy to target folder | `→` (Right Arrow) |
| ❌ Skip track | `←` (Left Arrow) |
| ⏯ Pause / Resume | `Space` |
| 🔊 Volume Up | `↑` (Up Arrow) |
| 🔉 Volume Down | `↓` (Down Arrow) |
| ⏩ Seek Forward | `D` |
| ⏪ Seek Backward | `A` |
| ⏭ Next Track | `S` |
| ⏮ Previous Track | `W` |

> All keys can be remapped in Settings. **Tip:** hold down the seek key (`A`/`D`) to keep rewinding or fast-forwarding continuously instead of pressing it repeatedly.

After each decision, the program automatically moves to the next track.

---

## 🖥️ Main Screen Overview

### Top Toolbar

**Source Folder** — where your music comes from. The app remembers the last folder you opened here, so next time it opens nearby.

**Target Folder** — where accepted tracks are sent. Also remembers your last pick.

**Split** — enables sorting into multiple folders at once.

**C / M** — switches between two modes for accepting tracks:
- **C** (Copy) — track is copied, original stays in place
- **M** (Move) — track is moved, removed from source folder

**⏭** — toggle automatic playback of the next track.

**👁** — toggle the audio visualizer on/off.

**Reset All** — completely reset everything and start over.

**⚙️** — open Settings.

You can also drag the whole window by clicking and holding any empty area of the top toolbar.

### Track Queue (Right Panel)
Shows all tracks with their statuses:

| Icon | Meaning |
|---|---|
| 🎵 Pending | Not yet listened to |
| 🎧 Played | Listened to, no decision made |
| ✓ Accepted | Accepted and copied |
| → Moved | Accepted and moved (file deleted from source) |
| ✗ Skipped | Skipped |
| ⚠️ Error | File is corrupted, skipped automatically |

Click any track to jump to it. Moved and damaged tracks cannot be clicked.

**🔍 Search box** — type any part of a filename above the queue to instantly filter it down. Clear the search (✗) to see the full queue again. The counter shows how many tracks match.

**⦿ button** — jumps the queue view back to whichever track is currently playing, useful if you've scrolled away searching for something.

**Cover All button** — appears when the current track has a cover image; applies that same cover to every other track in the queue with one click.

---

## ⚙️ Settings — Detailed Description

Open with the ⚙️ button in the top-right corner.

---

### General Tab

**Dark Mode** — switch between dark and light themes.

**Accept Mode — what happens when you press Accept:**
- *Copy* — file is copied to the target folder. Original stays. Safe option.
- *Move* — file is moved. Removed from source folder. Useful if you don't want duplicates.

**Auto-play next track** — when a track ends, the next one starts automatically. If disabled, you need to press Play manually.

**Auto-play after folder load** — music starts playing immediately after loading a folder. If disabled, you need to press Play manually.

**Auto-apply cover — what to do with cover art when accepting a track:**
- *Off* — do nothing automatically
- *On Accept* — when accepting a track, its cover is automatically written to the file
- *On Folder Load* — covers are applied to all tracks when loading the folder

---

### Audio Tab

**Seek Step** — seek amount when pressing `A` and `D`. From 5 to 30 seconds. Set larger for long mixes.

---

### Visualizer Tab

**Enable Visualizer** — show or hide audio animation.

**Visualization Mode** — animation style:
- *Dual Waveform* — two mirrored waveforms
- *RMS Meter* — volume level indicator
- *Aurora* — smooth light waves
- *VU Meter* — classic studio meters
- *Lissajous* — geometric figures from sound
- *Wave (Low Profile)* — compact wave, takes little space
- *Particle Flow* — particles fly upward with tails, reacting to every frequency
- *DNA Helix* — rotating double helix, bridges pulsate under the bass
- *Ink Drop* — organic spots that blur and breathe
- *City Lights* — thin neon columns with reflections and glowing tops
- *Neon Ring* — three concentric rings + particles around the circumference
- *Mirror Bars* — mirrored equalizer with a gradient from blue to purple
- *Plasma* — glowing colored orbs blending and pulsing with the bass
- *Oscilloscope* — a green line on a dark grid, like an old oscilloscope

**Sensitivity** — how actively the animation reacts to sound.

**Performance Mode** — reduces FPS for older computers.

---

### Hotkeys Tab

You can remap any control key. Click on the desired key — it highlights blue — press the new key. Done.

Remappable actions: accept track, skip, play/pause, volume, seek, previous/next track.

---

## 🎛️ Split Mode — Sorting into Multiple Folders at Once

Normal mode sends all accepted tracks to one folder. Split Mode is for when you want to sort tracks into different folders — by genre, mood, or artist.

### How to Set Up

1. Click the **Split** button in the top toolbar — a floating panel appears
2. Click **Add Folder** and select your first folder
3. The program will ask you to press a key — for example, press `1`
4. Click **Add Folder** again → select a second folder → press `2`
5. Add as many folders as you need

Now while listening, press the corresponding number — the track will be sent to that folder.

> If you press a key that's already bound to a different folder, the app will ask whether you want to rebind it to the new folder or cancel.

Each folder binding remembers the last subfolder you opened inside it, separately from every other binding, so navigating back into a deeply nested folder is faster the second time.

### Managing the Panel
- **Drag** the panel by its title bar to reposition it
- **Resize** the panel by dragging its right edge or bottom edge — both width and height can be adjusted, and the size is remembered
- Click **−** to collapse the panel (Split Mode stays on)
- The ⏭ button inside the panel toggles auto-advance to the next track after a Split Mode sort, independently of the main toolbar's auto-play setting
- Hover over a folder and click 🗑️ to remove it
- **Clear All Bindings** — remove all folders and bindings at once

> You cannot use keys already assigned to player controls — the app will warn you.

---

## 🖼️ Editing Cover Art

You can set or replace cover art for any track. It will be written directly into the music file and will be visible in any player.

1. Hover your mouse over the track title — small icons appear
2. Click 🖼️
3. Drag an image into the window or click to select a file (JPG, PNG up to 5 MB)
4. Click **Save Cover**

**Apply Cover to All** — a button in the right panel. Click it and the cover will be written to all tracks in the queue at once.

---

## ✏️ Renaming a Track

1. Hover your mouse over the track title
2. Click ✏️
3. Enter the new name (the extension like .mp3 will be added automatically)
4. **Enter** or ✓ — save, **Escape** or ✗ — cancel

The program renames the actual file on disk **and** writes the new name into all of the track's text tags (Title, Artist, Album, Year, Genre, Track #, Disc #, Album Artist, Composer, Comment) — so the new name shows up consistently everywhere, not just in the filename.

### Adding or Removing a Prefix / Suffix

Instead of renaming one track at a time, you can attach a short tag of text to the beginning (prefix) or end (suffix) of filenames in bulk:

1. Hover over the track title and click **[P]** (prefix) or **[S]** (suffix)
2. Type the text you want to add and press Enter (you can stack several pieces of text)
3. Choose:
   - **+ Apply to current** — adds it to just the track you're on
   - **+ Apply to all** — adds it to every track in the queue (skips tracks that already have it)
   - **− Remove from current** / **− Remove from all** — strips it back off

This is handy for tagging a whole batch with something like a DJ name, edit credit, or a release tag, without renaming every file by hand.

---

## 🎵 Editing Tags Directly

Below the player you can open the **Tags** panel to view and edit Title, Artist, Album, Year, Genre, Track #, BPM, Key, Composer, and Comment for the current track directly, without renaming the file. Press **Save** (or hit Enter in any field) to write your changes into the file.

If BPM/Key analysis is enabled in Settings, an **Analyze** button appears here too — press it to auto-detect BPM and musical key for the current track.

---

## 📁 Built-in File Browser

When you choose a folder, the program's own file browser opens. It can do the following:

| Button | Action |
|---|---|
| ⬆ Up | Go to parent folder |
| 🖥️ Desktop | Jump to Desktop |
| 📁 New Folder | Create a new folder right here |
| 🔄 Refresh | Refresh the list if you added a folder from outside the app |

- **Single click** — select a folder
- **Double click** — enter the folder
- **Right click** — rename or delete the folder. Note: deleting permanently removes the folder from your computer — it does **not** go to the Recycle Bin / Trash.

The statistics line shows how many audio files are in the current folder.

---

## 🔴 Corrupted Files

If a file cannot be played, the program will automatically mark it ⚠️, drop it into the **Broken Files** list, and move on to the next track. Other tracks are not affected. Open the Broken Files panel to copy the names (one or all at once) or save the full list to a text file for later review.

---

## 💾 Resuming Later

You can close the program at any time — progress is saved. When you reopen the same folder, already processed tracks will not load again; only the remaining ones will appear in the queue.

This allows you to sort large collections over multiple sessions.

> If you want to start over, press **Reset All**. Settings and hotkeys will not be reset.

---

## 💡 Tips

**Not sure about a decision?** Press `S` — the track will get a "Played" status and you can return to it later by clicking it in the right panel.

**Large collection?** Use `A` / `D` seek to quickly preview tracks without listening fully — hold the key down to keep skimming continuously. In Settings, you can set the seek step to 5, 10, 15, 20, 25, or 30 seconds.

**Sorting by genre?** Turn on Split Mode and bind folders to keys. Much faster than changing the target folder manually every time.

**Worried about your files?** Use **C (Copy)** mode — originals stay in place and nothing is lost if something goes wrong.

**Looking for a specific track?** Use the search box above the queue instead of scrolling through hundreds of files.

---

## 🛠️ System Requirements

- **OS:** Windows 10 or Windows 11 / macOS (Universal — works on both Intel and Apple Silicon Macs)
- **RAM:** 256 MB or more
- **Disk space:** Approximately 150 MB

---

## 🎵 Supported Formats

MP3, WAV, FLAC, AAC, OGG, M4A, OPUS, WMA, AIFF, APE, ALAC, WV, TTA, and other audio formats. Video files with audio: MP4, MKV, MOV, WEBM.

---

## 📞 Support

For questions and suggestions:

| Platform | Contact |
|---|---|
| **Instagram** | [@dj.dlm](https://instagram.com/dj.dlm) |
| **Telegram** | [@DJ_DLM_DJ](https://t.me/DJ_DLM_DJ) |

---

**Sortify — your personal music sorting assistant!** 🎧

Download link: https://drive.google.com/drive/folders/1GsCtwoVDWso1C6Q6y1lZdwJHbLK_TC_0?hl=ru

Repository for MacOS: https://github.com/DLM-01-code/rhythm_sort_mac

# Russian

# 🎵 Rhythm Sort — Твой личный сортировщик музыки

Rhythm Sort — это программа для Windows/Mac, которая помогает разобрать большую музыкальную коллекцию. Ты слушаешь треки по одному и решаешь что с ними делать — оставить, пропустить или отправить в нужную папку. Всё управляется с клавиатуры, без лишних кликов мышью.

---

## 📦 Установка

1. Скачай файл установщика `.exe` (Windows) или `.dmg` (Mac)
2. Запусти его и нажимай «Далее» (Windows) или перетащи приложение в Applications (Mac)
3. После установки открой **Rhythm Sort** с рабочего стола

> **Для пользователей Mac:** при первом запуске macOS может показать предупреждение «неизвестный разработчик», так как приложение не подписано сертификатом. Кликни правой кнопкой по приложению и выбери **Открыть** — это нужно сделать только один раз.

---

## 🚀 Как начать работу

### 1. Выбери папку с музыкой
Нажми большую кнопку **Source Folder** — откроется проводник. Найди папку с треками и нажми **Select This Folder**. Программа сама найдёт все музыкальные файлы внутри, даже если они разложены по подпапкам.

### 2. Выбери куда сохранять понравившиеся треки
Нажми **Target Folder** и выбери или создай папку куда будут отправляться треки которые ты одобришь.

### 3. Слушай и сортируй
Первый трек начнёт играть автоматически. Дальше всё просто:

| Что сделать | Клавиша |
|---|---|
| ✅ Принять трек — скопировать в папку назначения | `→` (стрелка вправо) |
| ❌ Пропустить трек | `←` (стрелка влево) |
| ⏯ Пауза / Продолжить | `Пробел` |
| 🔊 Громче | `↑` (стрелка вверх) |
| 🔉 Тише | `↓` (стрелка вниз) |
| ⏩ Перемотать вперёд | `D` |
| ⏪ Перемотать назад | `A` |
| ⏭ Следующий трек | `S` |
| ⏮ Предыдущий трек | `W` |

> Клавиши можно переназначать в настройках. **Совет:** зажми клавишу перемотки (`A`/`D`), чтобы перематывать непрерывно, а не нажимать её много раз подряд.

После каждого решения программа автоматически переходит к следующему треку.

---

## 🖥️ Что находится на главном экране

### Верхняя панель

**Source Folder** — папка откуда берётся музыка. Программа запоминает последнюю открытую здесь папку, так что в следующий раз проводник откроется рядом с ней.

**Target Folder** — папка куда отправляются принятые треки. Тоже запоминает последний выбор.

**Split** — кнопка включения режима сортировки по нескольким папкам сразу.

**C / M** — переключатель режима принятия треков:
- **C** (Copy) — трек копируется, оригинал остаётся на месте
- **M** (Move) — трек перемещается, из исходной папки удаляется

**⏭** — включить или выключить автоматический переход к следующему треку.

**👁** — включить или выключить визуализатор (анимация звука).

**Reset All** — полностью сбросить всё и начать заново.

**⚙️** — открыть настройки.

Всё окно можно перетаскивать, зажав и удерживая любую свободную область верхней панели.

### Очередь треков (правая панель)
Показывает все треки с их статусами:

| Значок | Что означает |
|---|---|
| 🎵 Pending | Ещё не прослушан |
| 🎧 Played | Прослушан, решение не принято |
| ✓ Accepted | Принят и скопирован |
| → Moved | Принят и перемещён (файл удалён из исходной папки) |
| ✗ Skipped | Пропущен |
| ⚠️ Error | Файл повреждён, программа пропустила его автоматически |

Кликни на любой трек чтобы перейти к нему. Перемещённые и повреждённые треки недоступны для перехода.

**🔍 Поле поиска** — введи часть имени файла над очередью чтобы мгновенно отфильтровать список. Очисти поиск (✗) чтобы увидеть всю очередь снова. Счётчик показывает сколько треков подходит под запрос.

**Кнопка ⦿** — возвращает список очереди к тому треку, который сейчас играет — удобно если ты прокрутил список далеко, что-то искал.

**Кнопка Cover All** — появляется когда у текущего трека есть обложка; одним кликом применяет эту же обложку ко всем остальным трекам в очереди.

---

## ⚙️ Настройки — подробное описание

Открываются кнопкой ⚙️ в правом верхнем углу.

---

### Вкладка General (Основные)

**Dark Mode** — переключить тёмную и светлую тему оформления.

**Accept Mode — что происходит с файлом когда нажимаешь «Принять»:**
- *Copy* — файл копируется в папку назначения. Оригинал остаётся на месте. Безопасный вариант.
- *Move* — файл перемещается. Из исходной папки удаляется. Удобно если не хочешь дублей.

**Auto-play next track** — когда трек заканчивается, следующий начинает играть автоматически. Если выключить — нужно нажать Play вручную.

**Auto-play after folder load** — музыка начинает играть сразу после загрузки папки. Если выключить — нужно нажать Play самому.

**Auto-apply cover — что делать с обложкой при принятии трека:**
- *Off* — ничего не делать автоматически.
- *On Accept* — при принятии трека его обложка автоматически записывается в файл.
- *On Folder Load* — обложки применяются ко всем трекам при загрузке папки.

---

### Вкладка Audio (Звук)

**Seek Step** — шаг перемотки при нажатии `A` и `D`. От 5 до 30 секунд. Поставь побольше если слушаешь длинные миксы.

---

### Вкладка Visualizer (Визуализатор)

**Enable Visualizer** — показывать или скрыть анимацию звука.

**Visualization Mode** — стиль анимации:
- *Dual Waveform* — две зеркальные волны
- *RMS Meter* — индикатор уровня громкости
- *Aurora* — плавные световые волны
- *VU Meter* — классические студийные стрелки
- *Lissajous* — геометрические фигуры от звука
- *Wave (Low Profile)* — компактная волна, занимает мало места
- *Particle Flow* — частицы летят вверх с хвостами, реагируют на каждую частоту
- *DNA Helix* — вращающаяся двойная спираль, перемычки пульсируют под бас
- *Ink Drop* — органические пятна которые расплываются и дышат
- *City Lights* — тонкие неоновые столбики с отражением и свечением верхушек
- *Neon Ring* — три концентрических кольца + частицы по окружности
- *Mirror Bars* — зеркальный эквалайзер с градиентом от синего к фиолетовому
- *Plasma* — светящиеся цветные сгустки, переливаются и пульсируют под бас
- *Oscilloscope* — зелёная линия на тёмной сетке как на старом осциллографе

**Sensitivity** — насколько активно реагирует анимация на звук.

**Performance Mode** — снижает FPS для слабых компьютеров.

---

### Вкладка Hotkeys (Горячие клавиши)

Можно переназначить любую клавишу управления. Кликни на нужную кнопку — она подсветится синим — нажми новую клавишу. Готово.

Переназначаются: принятие трека, пропуск, пауза, громкость, перемотка, переключение треков вперёд и назад.

---

## 🎛️ Split Mode — сортировка сразу по нескольким папкам

Обычный режим отправляет все принятые треки в одну папку, а Split Mode нужен когда хочешь раскладывать треки по разным папкам — например по жанрам, настроению или исполнителям.

### Как настроить

1. Нажми кнопку **Split** в верхней панели — появится плавающая панель
2. Нажми **Add Folder** и выбери первую папку
3. Программа попросит нажать клавишу — нажми например `1`
4. Нажми **Add Folder** снова → выбери вторую папку → нажми `2`
5. Добавь столько папок сколько нужно

Теперь во время прослушивания нажимай нужную цифру — трек сразу отправится в соответствующую папку.

> Если нажмёшь клавишу которая уже привязана к другой папке — программа спросит, перепривязать ли её на новую папку или отменить.

Каждая привязка папки запоминает последнюю открытую внутри неё подпапку отдельно от остальных привязок — так что заходить в глубоко вложенную папку второй раз будет быстрее.

### Управление панелью
- Панель можно **перетаскивать** по экрану за заголовок
- Панель можно **изменять размер**, потянув за правый или нижний край — регулируется и ширина, и высота, размер запоминается
- Кнопка **−** сворачивает панель (Split Mode при этом остаётся включённым)
- Кнопка ⏭ внутри панели включает или выключает автопереход к следующему треку после сортировки в Split Mode — отдельно от настройки автовоспроизведения в верхней панели
- При наведении на папку появляется 🗑️ — удалить эту папку
- **Clear All Bindings** — удалить все папки и привязки сразу

> Нельзя использовать клавиши которые уже заняты управлением плеером — программа предупредит.

---

## 🖼️ Редактирование обложки

Можно установить или заменить картинку-обложку для любого трека. Она запишется прямо в музыкальный файл и будет видна в любом плеере.

1. Наведи мышь на название трека — появятся маленькие иконки
2. Нажми 🖼️
3. Перетащи картинку в окно или кликни чтобы выбрать файл (JPG, PNG до 5 МБ)
4. Нажми **Save Cover**

**Apply Cover to All** — кнопка в правой панели. Нажми и она запишется во все треки очереди сразу.

---

## ✏️ Переименование трека

1. Наведи мышь на название трека
2. Нажми ✏️
3. Введи новое название (расширение .mp3 и т.д. добавится само)
4. **Enter** или ✓ — сохранить, **Escape** или ✗ — отменить

Программа переименует сам файл на диске **и** запишет новое название во все текстовые теги трека (Title, Artist, Album, Year, Genre, Track #, Disc #, Album Artist, Composer, Comment) — поэтому новое имя будет видно везде одинаково, а не только в названии файла.

### Добавление или удаление префикса / суффикса

Вместо переименования треков по одному можно массово добавить короткий текст в начало (префикс) или конец (суффикс) имени файла:

1. Наведи мышь на название трека и нажми **[P]** (префикс) или **[S]** (суффикс)
2. Введи текст который хочешь добавить и нажми Enter (можно добавить несколько кусков текста подряд)
3. Выбери:
   - **+ Apply to current** — добавить только к текущему треку
   - **+ Apply to all** — добавить ко всем трекам в очереди (треки где он уже есть — пропускаются)
   - **− Remove from current** / **− Remove from all** — убрать обратно

Удобно когда нужно подписать целую партию треков, например, именем DJ, припиской об эдите или меткой релиза, без переименования каждого файла руками.

---

## 🎵 Редактирование тегов напрямую

Под плеером можно открыть панель **Tags** чтобы посмотреть и отредактировать Title, Artist, Album, Year, Genre, Track #, BPM, Key, Composer и Comment текущего трека прямо там, без переименования файла. Нажми **Save** (или Enter в любом поле) чтобы записать изменения в файл.

Если в настройках включён анализ BPM/тональности, здесь же появится кнопка **Analyze** — нажми её чтобы автоматически определить BPM и тональность текущего трека.

---

## 📁 Встроенный проводник

Когда выбираешь папку — открывается собственный проводник программы. Он умеет следующее:

| Кнопка | Что делает |
|---|---|
| ⬆ Up | Перейти на папку выше |
| 🖥️ Desktop | Перейти на рабочий стол |
| 📁 New Folder | Создать новую папку прямо здесь |
| 🔄 Refresh | Обновить список если добавил папку снаружи |

- **Один клик** — выбрать папку
- **Двойной клик** — войти внутрь
- **Правый клик** — переименовать или удалить папку. Примечание — при удалении файл стирается с компьютера полностью без перемещения в корзину

В строке статистики показывается сколько аудиофайлов находится в текущей папке.

---

## 🔴 Повреждённые файлы

Если файл невозможно воспроизвести — программа автоматически пометит его ⚠️, добавит в список **Broken Files** и перейдёт к следующему треку. Остальные треки при этом не пострадают. Открой панель Broken Files чтобы скопировать названия (одно или все сразу) или сохранить весь список в текстовый файл для дальнейшей проверки.

---

## 💾 Продолжение после перерыва

Можно закрыть программу в любой момент — прогресс сохранится. При следующем открытии той же папки уже обработанные треки не загрузятся повторно, в очереди появятся только оставшиеся.

Это позволяет сортировать большие коллекции в несколько сессий.

> Хочешь начать заново — нажми **Reset All**. Настройки и горячие клавиши при этом не сбросятся.

---

## 💡 Советы

**Не уверен в решении?** Нажми `S` — трек получит статус «Played» и к нему можно вернуться позже кликнув в правой панели.

**Большая коллекция?** Используй перемотку `A` / `D` чтобы быстро оценивать треки не слушая целиком — зажми клавишу чтобы перематывать непрерывно. В настройках поставь шаг перемотки 5, 10, 15, 20, 25, 30 секунд.

**Сортируешь по жанрам?** Включи Split Mode и привяжи папки к клавишам. Намного быстрее чем менять папку назначения вручную каждый раз.

**Боишься за файлы?** Используй режим **C (Copy)** — оригиналы останутся на месте и ничего не потеряется если что-то пойдёт не так.

**Искать конкретный трек?** Используй поле поиска над очередью вместо прокрутки сотен файлов вручную.

---

## 🛠️ Системные требования

- **ОС:** Windows 10 или Windows 11 / macOS (Universal — работает и на Intel, и на Apple Silicon Mac)
- **Оперативная память:** от 256 МБ
- **Место на диске:** около 150 МБ

---

## 🎵 Поддерживаемые форматы

MP3, WAV, FLAC, AAC, OGG, M4A, OPUS, WMA, AIFF, APE, ALAC, WV, TTA и другие аудиоформаты. Видео с музыкой: MP4, MKV, MOV, WEBM.

---

## 📞 Поддержка
| Платформа | Контакт |
|---|---|
| **Instagram** | [@dj.dlm](https://instagram.com/dj.dlm) |
| **Telegram** | [@DJ_DLM_DJ](https://t.me/DJ_DLM_DJ) |

---

**Sortify — твой личный помощник в сортировке музыки!** 🎧

---

Ссылка на скачивание: https://drive.google.com/drive/folders/1GsCtwoVDWso1C6Q6y1lZdwJHbLK_TC_0?hl=ru

Репозиторий для MacOS: https://github.com/DLM-01-code/rhythm_sort_mac