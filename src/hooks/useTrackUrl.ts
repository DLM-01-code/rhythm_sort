// ========== useTrackUrl - ДЛЯ БОЛЬШИХ ФАЙЛОВ ==========
export function useTrackUrl(track: { path: string; url?: string; id?: string; name?: string } | undefined) {
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { setStatus, addBrokenTrack } = usePlayer();

  useEffect(() => {
    let objectUrl: string | undefined;
    let cancelled = false;

    async function load() {
      if (!track) {
        setUrl(undefined);
        setError(null);
        return;
      }

      // Если уже есть URL
      if (track.url) {
        setUrl(track.url);
        setError(null);
        return;
      }

      const api = isBrowser ? window.electronAPI : null;
      if (api) {
        setIsLoading(true);
        
        // Проверяем размер файла перед загрузкой
        try {
          // Получаем информацию о файле (размер)
          const fileInfo = await api.getFileInfo(track.path);
          
          // Если файл больше 50 MB - используем прямой путь
          const MAX_BUFFER_SIZE = 50 * 1024 * 1024; // 50 MB лимит для buffer
          
          if (fileInfo.size > MAX_BUFFER_SIZE) {
            console.log(`📦 Large file detected (${(fileInfo.size / 1024 / 1024).toFixed(1)} MB), using direct path`);
            // Для больших файлов используем прямой file:// URL
            const fileUrl = await api.getFileUrl(track.path);
            if (fileUrl && !cancelled) {
              setUrl(fileUrl);
              setError(null);
              console.log('✅ Direct URL created for large file:', track.name);
            } else {
              throw new Error('Failed to get file URL');
            }
          } else {
            // Для маленьких файлов используем buffer (работает с тегами)
            console.log(`📦 Small file (${(fileInfo.size / 1024 / 1024).toFixed(1)} MB), using buffer`);
            const buf = await api.readFileAsBuffer(track.path);
            if (cancelled) return;
            
            // Определяем MIME тип
            const ext = track.path.split('.').pop()?.toLowerCase();
            let mimeType = 'audio/mpeg';
            
            const mimeTypes: Record<string, string> = {
              'mp4': 'audio/mp4', 'm4a': 'audio/mp4', 'm4b': 'audio/mp4',
              'mp3': 'audio/mpeg', 'wav': 'audio/wav', 'flac': 'audio/flac',
              'aac': 'audio/aac', 'ogg': 'audio/ogg', 'oga': 'audio/ogg',
              'opus': 'audio/opus', 'webm': 'audio/webm'
            };
            mimeType = mimeTypes[ext || ''] || 'audio/mpeg';
            
            const blob = new Blob([buf], { type: mimeType });
            const u = URL.createObjectURL(blob);
            objectUrl = u;
            
            setUrl(u);
            setError(null);
            console.log('✅ Blob URL created for small file:', track.name);
          }
          
        } catch (e) {
          console.error('Failed to load track:', e);
          setError('Failed to load file');
          setUrl(undefined);
          
          if (track.id && track.name) {
            setStatus(track.id, "error");
            addBrokenTrack({
              id: track.id,
              name: track.name,
              path: track.path
            });
          }
        } finally {
          setIsLoading(false);
        }
      } else {
        console.warn('No electronAPI, cannot load local file:', track.path);
        setUrl(undefined);
        setError('No electronAPI available');
      }
    }

    load();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [track?.path, track?.url, track?.id, track?.name, setStatus, addBrokenTrack]);

  return { url, error, isLoading };
}