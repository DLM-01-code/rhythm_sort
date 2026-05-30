import { useState, useEffect } from 'react';

export interface WaveformData {
  peaks: number[];
  duration: number;
  samples: number;
}

export function useWaveform(audioUrl: string | undefined, trackPath?: string) {
  const [waveform, setWaveform] = useState<WaveformData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!audioUrl) {
      setWaveform(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextClass();

    fetch(audioUrl)
      .then(response => response.arrayBuffer())
      .then(arrayBuffer => audioContext.decodeAudioData(arrayBuffer))
      .then(audioBuffer => {
        const channelData = audioBuffer.getChannelData(0);
        
        const targetSamples = 800;
        const step = Math.floor(channelData.length / targetSamples);
        
        const peaks: number[] = [];
        
        for (let i = 0; i < targetSamples; i++) {
          const start = i * step;
          let maxPeak = 0;
          
          for (let j = 0; j < step && start + j < channelData.length; j++) {
            const value = Math.abs(channelData[start + j]);
            if (value > maxPeak) maxPeak = value;
          }
          
          peaks.push(maxPeak);
        }
        
        setWaveform({
          peaks,
          duration: audioBuffer.duration,
          samples: targetSamples
        });
        
        setIsLoading(false);
        audioContext.close();
      })
      .catch(err => {
        console.error('Failed to analyze waveform:', err);
        setError(err.message);
        setIsLoading(false);
        audioContext.close();
      });
  }, [audioUrl]);

  return { waveform, isLoading, error };
}