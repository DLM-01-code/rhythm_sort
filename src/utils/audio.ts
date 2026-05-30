export const AUDIO_EXTS = [
  // Основные форматы
  "mp3", "wav", "flac", "aac", "ogg", "m4a", "m4b", "m4r", "m4p",
  // Видео с аудиодорожкой
  "mp4", "mpeg", "mpga", "mp2", "mpa",
  // Другие аудиоформаты
  "opus", "wma", "wmv", "aiff", "aif", "aifc", "caf", "alac", 
  "ape", "dsf", "dff", "dvf", "gsm", "ircam", "m3u", "mka", 
  "mlp", "ra", "rm", "snd", "tak", "tta", "voc", "vox", "wv",
  // Редкие форматы
  "3gp", "amr", "awb", "dct", "dss", "dvms", "m4v", "mkv", "mov",
  "mpv", "oga", "ogv", "ogx", "spx", "webm"
];

// Проверка является ли файл аудио
export function isAudioFile(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  return AUDIO_EXTS.includes(ext);
}

// Получить расширение файла
export function getFileExtension(filename: string): string {
  return filename.split('.').pop()?.toLowerCase() || '';
}