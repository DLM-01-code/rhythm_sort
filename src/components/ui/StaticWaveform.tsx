import React, { useRef, useEffect, useState } from 'react';

interface StaticWaveformProps {
  peaks: number[];
  currentTime: number;
  duration: number;
  onSeek?: (progress: number) => void;
  color?: string;
  backgroundColor?: string;
}

export function StaticWaveform({ 
  peaks, 
  currentTime, 
  duration, 
  onSeek,
  color = "#3b82f6",
  backgroundColor = "rgba(59, 130, 246, 0.15)"
}: StaticWaveformProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const drawWaveform = () => {
    const canvas = canvasRef.current;
    if (!canvas || !peaks.length) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear canvas
    ctx.fillStyle = '#0f1117';
    ctx.fillRect(0, 0, width, height);
    
    const barWidth = width / peaks.length;
    const centerY = height / 2;
    
    // Draw static waveform
    for (let i = 0; i < peaks.length; i++) {
      const peak = peaks[i];
      const barHeight = Math.max(1, peak * height * 0.8);
      
      // Background waveform
      ctx.fillStyle = backgroundColor;
      ctx.fillRect(i * barWidth, centerY - barHeight / 2, barWidth - 1, barHeight);
      
      // Colored line on top
      ctx.fillStyle = color;
      ctx.fillRect(i * barWidth, centerY - barHeight / 2, barWidth - 1, Math.max(1, barHeight * 0.4));
    }
    
    // Draw current position line
    if (duration > 0 && currentTime >= 0) {
      const progress = Math.min(1, Math.max(0, currentTime / duration));
      const lineX = progress * width;
      
      ctx.beginPath();
      ctx.moveTo(lineX, 0);
      ctx.lineTo(lineX, height);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // Circle on the line
      ctx.beginPath();
      ctx.arc(lineX, height / 2, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.shadowBlur = 4;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 0;
    }
  };

  useEffect(() => {
    drawWaveform();
  }, [peaks, currentTime, duration, color, backgroundColor]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const progress = Math.max(0, Math.min(1, x / rect.width));
    onSeek(progress);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !onSeek) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));
    const progress = x / rect.width;
    onSeek(progress);
  };

  if (!peaks.length) {
    return (
      <div className="w-full h-30 rounded-lg bg-black/20 flex items-center justify-center text-muted-foreground text-sm">
        Loading waveform...
      </div>
    );
  }

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={100}
      className="w-full h-25 rounded-lg cursor-pointer"
      onClick={handleClick}
      onMouseDown={() => setIsDragging(true)}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
      style={{ display: "block" }}
    />
  );
}