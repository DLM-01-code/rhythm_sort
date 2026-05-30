import React, { useEffect, useRef, useState } from "react";

interface VisualizerProps {
  analyser: AnalyserNode | null;
  mode: string;
  enabled: boolean;
  sensitivity: number;
  perfMode: boolean;
  onSeek?: (progress: number) => void;
}

export function Visualizer({ analyser, mode, enabled, sensitivity, perfMode, onSeek }: VisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const [isDragging, setIsDragging] = useState(false);
  const [time, setTime] = useState(0);
  const [beatIntensity, setBeatIntensity] = useState(0);
  
  // Для сглаживания
  const smoothDataRef = useRef<Uint8Array | null>(null);
  const smoothingFactor = 0.3; // Чем меньше, тем плавнее (0.1 - очень плавно, 0.5 - быстро)

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#0f1117";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  useEffect(() => {
    if (!enabled || !analyser) {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = undefined;
      }
      clearCanvas();
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const bufferLength = analyser.frequencyBinCount;
    const freqArray = new Uint8Array(bufferLength);
    const timeArray = new Uint8Array(bufferLength);
    
    // Инициализация сглаженных данных
    if (!smoothDataRef.current) {
      smoothDataRef.current = new Uint8Array(bufferLength);
    }

    let frameCount = 0;
    const fpsLimit = perfMode ? 30 : 60;
    const frameInterval = Math.floor(60 / fpsLimit);

    let lastBassAvg = 0;

    const draw = () => {
      frameCount++;
      if (perfMode && frameCount % frameInterval !== 0) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      analyser.getByteFrequencyData(freqArray);
      analyser.getByteTimeDomainData(timeArray);
      
      // Применяем сглаживание к данным
      if (smoothDataRef.current) {
        for (let i = 0; i < timeArray.length; i++) {
          smoothDataRef.current[i] = smoothDataRef.current[i] * (1 - smoothingFactor) + timeArray[i] * smoothingFactor;
        }
      }
      
      setTime((prev) => prev + 0.02);

      // Beat detection
      let bassSum = 0;
      const bassBinEnd = Math.floor(bufferLength * 0.1);
      for (let i = 0; i < bassBinEnd; i++) {
        bassSum += freqArray[i];
      }
      const bassAvg = bassSum / bassBinEnd;
      const beat = bassAvg > lastBassAvg * 1.5 && bassAvg > 100;
      if (beat) {
        setBeatIntensity(1);
      } else {
        setBeatIntensity((prev) => Math.max(0, prev - 0.05));
      }
      lastBassAvg = bassAvg;

      const width = canvas.width;
      const height = canvas.height;

      // Полная очистка
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#0f1117";
      ctx.fillRect(0, 0, width, height);

      switch (mode) {
        case "dual_waveform":
          drawDualWaveform(ctx, width, height, smoothDataRef.current || timeArray, sensitivity);
          break;
        case "rms_meter":
          drawRmsMeter(ctx, width, height, freqArray, sensitivity);
          break;
        case "aurora":
          drawAurora(ctx, width, height, freqArray, sensitivity, time);
          break;
        case "vu_meter":
          drawVuMeter(ctx, width, height, freqArray, sensitivity);
          break;
        case "lissajous":
          drawLissajous(ctx, width, height, timeArray, sensitivity);
          break;
        case "wave":
          drawWave(ctx, width, height, smoothDataRef.current || timeArray, sensitivity);
          break;
        default:
          drawDualWaveform(ctx, width, height, smoothDataRef.current || timeArray, sensitivity);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      clearCanvas();
    };
  }, [analyser, enabled, mode, sensitivity, perfMode]);

  useEffect(() => {
    clearCanvas();
  }, [mode]);

  // 1. Dual Waveform - ПЛАВНЫЙ
  const drawDualWaveform = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dataArray: Uint8Array,
    sensitivity: number
  ) => {
    const sliceWidth = width / dataArray.length;
    let x = 0;
    
    // Верхняя волна (синяя) - сглаженная
    ctx.beginPath();
    ctx.moveTo(0, height / 4);
    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128;
      const y = v * height * 0.25 + height / 4;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Нижняя волна (оранжевая) - сглаженная
    x = 0;
    ctx.beginPath();
    ctx.moveTo(0, height * 0.75);
    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128;
      const y = v * height * 0.25 + height * 0.75;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.strokeStyle = "#f97316";
    ctx.lineWidth = 2;
    ctx.stroke();
    
    // Разделительная линия
    ctx.beginPath();
    ctx.moveTo(0, height / 2);
    ctx.lineTo(width, height / 2);
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.stroke();
  };

  // 2. RMS Meter
  const drawRmsMeter = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dataArray: Uint8Array,
    sensitivity: number
  ) => {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const rms = (sum / dataArray.length / 255) * sensitivity;
    
    const meterWidth = width - 40;
    const meterHeight = 20;
    const meterX = 20;
    const meterY = height / 2 - meterHeight / 2;
    
    ctx.fillStyle = "#1e1e2e";
    ctx.fillRect(meterX, meterY, meterWidth, meterHeight);
    
    let color;
    if (rms < 0.6) color = "#22c55e";
    else if (rms < 0.8) color = "#eab308";
    else color = "#ef4444";
    
    ctx.fillStyle = color;
    ctx.fillRect(meterX, meterY, meterWidth * Math.min(1, rms), meterHeight);
    
    ctx.font = "bold 20px monospace";
    ctx.fillStyle = color;
    ctx.fillText(`${Math.floor(rms * 100)}%`, width / 2 - 30, meterY - 10);
    
    for (let i = 0; i <= 10; i++) {
      const x = meterX + (meterWidth / 10) * i;
      ctx.fillStyle = "#666";
      ctx.fillRect(x, meterY + meterHeight, 1, 5);
    }
  };

  // 3. Aurora
  const drawAurora = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dataArray: Uint8Array,
    sensitivity: number,
    time: number
  ) => {
    for (let i = 0; i < dataArray.length; i++) {
      const value = dataArray[i] / 255;
      const barHeight = value * height * 0.5 * sensitivity;
      const hue = (time * 20 + i * 0.5) % 360;
      const intensity = 0.3 + value * 0.5;
      
      const gradient = ctx.createLinearGradient(0, height, 0, height - barHeight);
      gradient.addColorStop(0, `hsla(${hue}, 100%, 50%, ${intensity})`);
      gradient.addColorStop(1, `hsla(${hue + 40}, 100%, 30%, 0.1)`);
      
      ctx.fillStyle = gradient;
      ctx.fillRect(i * (width / dataArray.length), height - barHeight, width / dataArray.length, barHeight);
    }
    
    for (let i = 0; i < 50; i++) {
      const starX = (Math.sin(i * 100 + time) * 0.5 + 0.5) * width;
      const starY = (Math.cos(i * 50 + time * 0.5) * 0.3 + 0.3) * height;
      ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(time + i) * 0.2})`;
      ctx.fillRect(starX, starY, 1, 1);
    }
  };

  // 4. VU Meter
  const drawVuMeter = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dataArray: Uint8Array,
    sensitivity: number
  ) => {
    const lampCount = 20;
    const lampSize = 15;
    const spacing = 8;
    const startX = (width - (lampCount * (lampSize + spacing))) / 2;
    const y = height / 2 - lampSize / 2;
    
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      sum += dataArray[i];
    }
    const level = (sum / dataArray.length / 255) * sensitivity;
    const litCount = Math.floor(level * lampCount);
    
    for (let i = 0; i < lampCount; i++) {
      const x = startX + i * (lampSize + spacing);
      const isLit = i < litCount;
      
      let color;
      if (i < lampCount * 0.6) color = "#22c55e";
      else if (i < lampCount * 0.8) color = "#eab308";
      else color = "#ef4444";
      
      ctx.fillStyle = isLit ? color : "#1e1e2e";
      ctx.fillRect(x, y, lampSize, lampSize);
      
      if (isLit) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = color;
        ctx.fillRect(x, y, lampSize, lampSize);
        ctx.shadowBlur = 0;
      }
    }
    
    ctx.font = "12px monospace";
    ctx.fillStyle = "#666";
    ctx.fillText("-60dB", startX - 40, y + lampSize / 2);
    ctx.fillText("0dB", startX + lampCount * (lampSize + spacing) + 10, y + lampSize / 2);
  };

  // 5. Lissajous
  const drawLissajous = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dataArray: Uint8Array,
    sensitivity: number
  ) => {
    const centerX = width / 2;
    const centerY = height / 2;
    const radius = Math.min(width, height) / 3;
    
    const leftChannel = new Uint8Array(Math.floor(dataArray.length / 2));
    const rightChannel = new Uint8Array(Math.floor(dataArray.length / 2));
    
    for (let i = 0; i < leftChannel.length; i++) {
      leftChannel[i] = dataArray[i];
      rightChannel[i] = dataArray[i + leftChannel.length];
    }
    
    ctx.beginPath();
    for (let i = 0; i < leftChannel.length; i++) {
      const x = (leftChannel[i] - 128) / 128;
      const y = (rightChannel[i] - 128) / 128;
      const px = centerX + x * radius;
      const py = centerY + y * radius;
      
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.strokeStyle = "#00ff88";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };

  // 6. Wave - ПЛАВНЫЙ
  const drawWave = (
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    dataArray: Uint8Array,
    sensitivity: number
  ) => {
    const sliceWidth = width / dataArray.length;
    let x = 0;
    const amplitude = 0.25;
    const yOffset = height * 0.7;
    
    ctx.beginPath();
    ctx.moveTo(0, yOffset);
    
    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128;
      const y = yOffset + v * height * amplitude;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
      x += sliceWidth;
    }
    
    ctx.strokeStyle = "#1e40af";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, yOffset - 10, 0, height);
    gradient.addColorStop(0, "rgba(30, 64, 175, 0.15)");
    gradient.addColorStop(1, "rgba(30, 64, 175, 0)");
    ctx.fillStyle = gradient;
    ctx.fill();
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
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
    onSeek(x / rect.width);
  };

  return (
    <canvas
      ref={canvasRef}
      width={800}
      height={200}
      className="w-full h-48 rounded-lg bg-black/20 cursor-pointer"
      onClick={handleCanvasClick}
      onMouseDown={() => setIsDragging(true)}
      onMouseMove={handleMouseMove}
      onMouseUp={() => setIsDragging(false)}
      onMouseLeave={() => setIsDragging(false)}
      style={{ display: "block" }}
    />
  );
}