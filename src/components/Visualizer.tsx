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

  const smoothDataRef = useRef<Uint8Array | null>(null);
  const smoothingFactor = 0.3;

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

    if (!smoothDataRef.current) {
      smoothDataRef.current = new Uint8Array(bufferLength);
    }

    let frameCount = 0;
    const fpsLimit = perfMode ? 30 : 60;
    const frameInterval = Math.floor(60 / fpsLimit);
    let lastBassAvg = 0;
    let localTime = 0;

    const draw = () => {
      frameCount++;
      if (perfMode && frameCount % frameInterval !== 0) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      analyser.getByteFrequencyData(freqArray);
      analyser.getByteTimeDomainData(timeArray);

      if (smoothDataRef.current) {
        for (let i = 0; i < timeArray.length; i++) {
          smoothDataRef.current[i] = smoothDataRef.current[i] * (1 - smoothingFactor) + timeArray[i] * smoothingFactor;
        }
      }

      localTime += 0.02;
      setTime(localTime);

      let bassSum = 0;
      const bassBinEnd = Math.floor(bufferLength * 0.1);
      for (let i = 0; i < bassBinEnd; i++) bassSum += freqArray[i];
      const bassAvg = bassSum / bassBinEnd;
      const beat = bassAvg > lastBassAvg * 1.5 && bassAvg > 100;
      if (beat) setBeatIntensity(1);
      else setBeatIntensity((prev) => Math.max(0, prev - 0.05));
      lastBassAvg = bassAvg;

      const width = canvas.width;
      const height = canvas.height;

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#0f1117";
      ctx.fillRect(0, 0, width, height);

      const smooth = smoothDataRef.current || timeArray;

      switch (mode) {
        case "dual_waveform":   drawDualWaveform(ctx, width, height, smooth, sensitivity); break;
        case "rms_meter":       drawRmsMeter(ctx, width, height, freqArray, sensitivity); break;
        case "aurora":          drawAurora(ctx, width, height, freqArray, sensitivity, localTime); break;
        case "vu_meter":        drawVuMeter(ctx, width, height, freqArray, sensitivity); break;
        case "lissajous":       drawLissajous(ctx, width, height, timeArray, sensitivity); break;
        case "wave":            drawWave(ctx, width, height, smooth, sensitivity); break;
        case "particle_flow":   drawParticleFlow(ctx, width, height, freqArray, sensitivity, localTime); break;
        case "dna_helix":       drawDnaHelix(ctx, width, height, freqArray, sensitivity, localTime); break;
        case "ink_drop":        drawInkDrop(ctx, width, height, freqArray, smooth, sensitivity, localTime); break;
        case "city_lights":     drawCityLights(ctx, width, height, freqArray, sensitivity, localTime); break;
        case "neon_ring":       drawNeonRing(ctx, width, height, freqArray, sensitivity, localTime); break;
        case "mirror_bars":     drawMirrorBars(ctx, width, height, freqArray, sensitivity); break;
        case "plasma":          drawPlasma(ctx, width, height, freqArray, sensitivity, localTime); break;
        case "oscilloscope":    drawOscilloscope(ctx, width, height, smooth, sensitivity); break;
        default:                drawDualWaveform(ctx, width, height, smooth, sensitivity);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      clearCanvas();
    };
  }, [analyser, enabled, mode, sensitivity, perfMode]);

  useEffect(() => { clearCanvas(); }, [mode]);

  // ─── СУЩЕСТВУЮЩИЕ РЕЖИМЫ ───────────────────────────────────────────────────

  const drawDualWaveform = (ctx: CanvasRenderingContext2D, width: number, height: number, dataArray: Uint8Array, sensitivity: number) => {
    const sliceWidth = width / dataArray.length;
    let x = 0;
    ctx.beginPath();
    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128;
      const y = v * height * 0.25 * sensitivity + height / 4;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 2; ctx.stroke();
    x = 0;
    ctx.beginPath();
    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128;
      const y = v * height * 0.25 * sensitivity + height * 0.75;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.strokeStyle = "#f97316"; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, height / 2); ctx.lineTo(width, height / 2);
    ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.stroke();
  };

  const drawRmsMeter = (ctx: CanvasRenderingContext2D, width: number, height: number, dataArray: Uint8Array, sensitivity: number) => {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    const rms = (sum / dataArray.length / 255) * sensitivity;
    const meterWidth = width - 40;
    const meterHeight = 20;
    const meterX = 20;
    const meterY = height / 2 - meterHeight / 2;
    ctx.fillStyle = "#1e1e2e"; ctx.fillRect(meterX, meterY, meterWidth, meterHeight);
    const color = rms < 0.6 ? "#22c55e" : rms < 0.8 ? "#eab308" : "#ef4444";
    ctx.fillStyle = color; ctx.fillRect(meterX, meterY, meterWidth * Math.min(1, rms), meterHeight);
    ctx.font = "bold 20px monospace"; ctx.fillStyle = color;
    ctx.fillText(`${Math.floor(rms * 100)}%`, width / 2 - 30, meterY - 10);
    for (let i = 0; i <= 10; i++) {
      ctx.fillStyle = "#666";
      ctx.fillRect(meterX + (meterWidth / 10) * i, meterY + meterHeight, 1, 5);
    }
  };

  const drawAurora = (ctx: CanvasRenderingContext2D, width: number, height: number, dataArray: Uint8Array, sensitivity: number, time: number) => {
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

  const drawVuMeter = (ctx: CanvasRenderingContext2D, width: number, height: number, dataArray: Uint8Array, sensitivity: number) => {
    const lampCount = 20; const lampSize = 15; const spacing = 8;
    const startX = (width - (lampCount * (lampSize + spacing))) / 2;
    const y = height / 2 - lampSize / 2;
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    const level = (sum / dataArray.length / 255) * sensitivity;
    const litCount = Math.floor(level * lampCount);
    for (let i = 0; i < lampCount; i++) {
      const x = startX + i * (lampSize + spacing);
      const isLit = i < litCount;
      const color = i < lampCount * 0.6 ? "#22c55e" : i < lampCount * 0.8 ? "#eab308" : "#ef4444";
      ctx.fillStyle = isLit ? color : "#1e1e2e"; ctx.fillRect(x, y, lampSize, lampSize);
      if (isLit) { ctx.shadowBlur = 8; ctx.shadowColor = color; ctx.fillRect(x, y, lampSize, lampSize); ctx.shadowBlur = 0; }
    }
    ctx.font = "12px monospace"; ctx.fillStyle = "#666";
    ctx.fillText("-60dB", startX - 40, y + lampSize / 2);
    ctx.fillText("0dB", startX + lampCount * (lampSize + spacing) + 10, y + lampSize / 2);
  };

  const drawLissajous = (ctx: CanvasRenderingContext2D, width: number, height: number, dataArray: Uint8Array, sensitivity: number) => {
    const centerX = width / 2; const centerY = height / 2;
    const radius = Math.min(width, height) / 3;
    const half = Math.floor(dataArray.length / 2);
    ctx.beginPath();
    for (let i = 0; i < half; i++) {
      const x = ((dataArray[i] - 128) / 128) * radius * sensitivity;
      const y = ((dataArray[i + half] - 128) / 128) * radius * sensitivity;
      i === 0 ? ctx.moveTo(centerX + x, centerY + y) : ctx.lineTo(centerX + x, centerY + y);
    }
    ctx.strokeStyle = "#00ff88"; ctx.lineWidth = 1.5; ctx.stroke();
  };

  const drawWave = (ctx: CanvasRenderingContext2D, width: number, height: number, dataArray: Uint8Array, sensitivity: number) => {
    const sliceWidth = width / dataArray.length;
    let x = 0;
    const yOffset = height * 0.7;
    ctx.beginPath();
    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128;
      const y = yOffset + v * height * 0.25 * sensitivity;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceWidth;
    }
    ctx.strokeStyle = "#1e40af"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.lineTo(width, height); ctx.lineTo(0, height); ctx.closePath();
    const gradient = ctx.createLinearGradient(0, yOffset - 10, 0, height);
    gradient.addColorStop(0, "rgba(30, 64, 175, 0.15)");
    gradient.addColorStop(1, "rgba(30, 64, 175, 0)");
    ctx.fillStyle = gradient; ctx.fill();
  };

  // ─── НОВЫЕ РЕЖИМЫ ─────────────────────────────────────────────────────────

  // 7. Particle Flow — частицы летят вверх в ритм баса
  const drawParticleFlow = (ctx: CanvasRenderingContext2D, width: number, height: number, dataArray: Uint8Array, sensitivity: number, time: number) => {
    const count = 80;
    for (let i = 0; i < count; i++) {
      const binIndex = Math.floor((i / count) * dataArray.length);
      const value = (dataArray[binIndex] / 255) * sensitivity;
      if (value < 0.05) continue;

      const x = (i / count) * width;
      const speed = value * 3;
      const y = height - ((time * speed * 60 + i * 37) % height);
      const size = 1.5 + value * 4;
      const hue = 200 + i * 1.5;
      const alpha = 0.3 + value * 0.7;

      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, 90%, 65%, ${alpha})`;
      ctx.fill();

      // Хвост
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, Math.min(height, y + size * 4));
      ctx.strokeStyle = `hsla(${hue}, 90%, 65%, ${alpha * 0.3})`;
      ctx.lineWidth = size * 0.6;
      ctx.stroke();
    }
  };

  // 8. DNA Helix — двойная спираль
  const drawDnaHelix = (ctx: CanvasRenderingContext2D, width: number, height: number, dataArray: Uint8Array, sensitivity: number, time: number) => {
    const centerY = height / 2;
    const amplitude = height * 0.3;
    const frequency = 3;
    const points = 120;

    for (let i = 0; i <= points; i++) {
      const t = (i / points) * Math.PI * 2 * frequency;
      const x = (i / points) * width;
      const binIndex = Math.floor((i / points) * dataArray.length * 0.5);
      const energy = (dataArray[binIndex] / 255) * sensitivity;

      const y1 = centerY + Math.sin(t + time * 2) * amplitude * (0.4 + energy * 0.6);
      const y2 = centerY - Math.sin(t + time * 2) * amplitude * (0.4 + energy * 0.6);

      const hue1 = (t * 30 + time * 40) % 360;
      const hue2 = (hue1 + 180) % 360;
      const r = 3 + energy * 4;

      // Точки спирали 1
      ctx.beginPath();
      ctx.arc(x, y1, r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue1}, 100%, 65%, 0.9)`;
      ctx.shadowBlur = 8; ctx.shadowColor = `hsla(${hue1}, 100%, 65%, 0.5)`;
      ctx.fill();

      // Точки спирали 2
      ctx.beginPath();
      ctx.arc(x, y2, r, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue2}, 100%, 65%, 0.9)`;
      ctx.shadowColor = `hsla(${hue2}, 100%, 65%, 0.5)`;
      ctx.fill();
      ctx.shadowBlur = 0;

      // Соединяющие перемычки
      if (i % 8 === 0) {
        ctx.beginPath();
        ctx.moveTo(x, y1); ctx.lineTo(x, y2);
        ctx.strokeStyle = `rgba(255,255,255,${0.1 + energy * 0.2})`;
        ctx.lineWidth = 1; ctx.stroke();
      }
    }
  };

  // 9. Ink Drop — пятна чернил от баса
  const drawInkDrop = (ctx: CanvasRenderingContext2D, width: number, height: number, freqArray: Uint8Array, timeArray: Uint8Array, sensitivity: number, time: number) => {
    const drops = 12;
    for (let i = 0; i < drops; i++) {
      const binIndex = Math.floor((i / drops) * freqArray.length * 0.4);
      const energy = (freqArray[binIndex] / 255) * sensitivity;
      if (energy < 0.1) continue;

      const x = width * (0.1 + (i / drops) * 0.8);
      const y = height * (0.2 + Math.sin(time * 0.5 + i) * 0.2 + 0.3);
      const radius = energy * Math.min(width, height) * 0.18;

      const hue = (i * 25 + time * 15) % 360;

      // Внешнее кольцо — расплывается
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `hsla(${hue}, 60%, 40%, ${energy * 0.7})`);
      gradient.addColorStop(0.5, `hsla(${hue}, 70%, 30%, ${energy * 0.3})`);
      gradient.addColorStop(1, `hsla(${hue}, 80%, 20%, 0)`);

      ctx.beginPath();
      ctx.ellipse(x, y, radius, radius * 0.7, Math.sin(time + i) * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();

      // Центральная точка
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.15, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, 80%, 70%, ${energy})`;
      ctx.fill();
    }
  };

  // 10. City Lights — тонкие неоновые столбики
  const drawCityLights = (ctx: CanvasRenderingContext2D, width: number, height: number, dataArray: Uint8Array, sensitivity: number, time: number) => {
    const barCount = 64;
    const barWidth = (width / barCount) * 0.6;
    const gap = (width / barCount) * 0.4;

    for (let i = 0; i < barCount; i++) {
      const binIndex = Math.floor((i / barCount) * dataArray.length * 0.75);
      const value = (dataArray[binIndex] / 255) * sensitivity;
      const barHeight = value * height * 0.85;
      const x = i * (barWidth + gap) + gap / 2;
      const y = height - barHeight;

      const hue = 200 + i * 1.2;
      const lightness = 50 + value * 30;

      // Градиент снизу вверх
      const gradient = ctx.createLinearGradient(0, height, 0, y);
      gradient.addColorStop(0, `hsla(${hue}, 100%, ${lightness}%, 0.9)`);
      gradient.addColorStop(0.6, `hsla(${hue + 20}, 100%, ${lightness + 10}%, 0.5)`);
      gradient.addColorStop(1, `hsla(${hue + 40}, 100%, 80%, 0.1)`);

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth, barHeight);

      // Свечение сверху
      if (value > 0.3) {
        ctx.shadowBlur = 12;
        ctx.shadowColor = `hsla(${hue}, 100%, 70%, 0.8)`;
        ctx.fillStyle = `hsla(${hue}, 100%, 85%, 0.9)`;
        ctx.fillRect(x, y, barWidth, 2);
        ctx.shadowBlur = 0;
      }

      // Отражение снизу (слабое)
      const refGradient = ctx.createLinearGradient(0, height, 0, height + barHeight * 0.3);
      refGradient.addColorStop(0, `hsla(${hue}, 100%, ${lightness}%, 0.15)`);
      refGradient.addColorStop(1, `hsla(${hue}, 100%, ${lightness}%, 0)`);
      ctx.fillStyle = refGradient;
      ctx.fillRect(x, height, barWidth, barHeight * 0.3);
    }
  };

  // 11. Neon Ring — пульсирующее кольцо
  const drawNeonRing = (ctx: CanvasRenderingContext2D, width: number, height: number, dataArray: Uint8Array, sensitivity: number, time: number) => {
    const centerX = width / 2;
    const centerY = height / 2;

    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    const avg = (sum / dataArray.length / 255) * sensitivity;

    const baseRadius = Math.min(width, height) * 0.25;
    const rings = 3;

    for (let r = rings; r >= 1; r--) {
      const radius = baseRadius * (0.5 + avg * 0.5) * (r / rings) + r * 8;
      const hue = (time * 30 + r * 40) % 360;
      const alpha = (1 / r) * (0.4 + avg * 0.6);

      ctx.beginPath();
      ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
      ctx.strokeStyle = `hsla(${hue}, 100%, 65%, ${alpha})`;
      ctx.lineWidth = r === 1 ? 2.5 : 1;
      ctx.shadowBlur = 20 * avg;
      ctx.shadowColor = `hsla(${hue}, 100%, 65%, 0.8)`;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Частицы по окружности
    const particleCount = 48;
    for (let i = 0; i < particleCount; i++) {
      const binIndex = Math.floor((i / particleCount) * dataArray.length);
      const energy = (dataArray[binIndex] / 255) * sensitivity;
      const angle = (i / particleCount) * Math.PI * 2 + time;
      const dist = baseRadius * (0.5 + avg * 0.5) + energy * 20;

      const px = centerX + Math.cos(angle) * dist;
      const py = centerY + Math.sin(angle) * dist;
      const hue = (time * 30 + i * 7.5) % 360;

      ctx.beginPath();
      ctx.arc(px, py, 1.5 + energy * 3, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue}, 100%, 75%, ${0.5 + energy * 0.5})`;
      ctx.fill();
    }
  };

  // 12. Mirror Bars — зеркальный эквалайзер с градиентом
  const drawMirrorBars = (ctx: CanvasRenderingContext2D, width: number, height: number, dataArray: Uint8Array, sensitivity: number) => {
    const barCount = 80;
    const barWidth = (width / barCount) - 1;
    const centerY = height / 2;

    for (let i = 0; i < barCount; i++) {
      const binIndex = Math.floor((i / barCount) * dataArray.length * 0.8);
      const value = (dataArray[binIndex] / 255) * sensitivity;
      const barHeight = value * (height / 2) * 0.9;

      const hue = 240 + i * (120 / barCount);
      const x = i * (barWidth + 1);

      // Верхняя половина
      const gradTop = ctx.createLinearGradient(0, centerY, 0, centerY - barHeight);
      gradTop.addColorStop(0, `hsla(${hue}, 90%, 55%, 0.9)`);
      gradTop.addColorStop(1, `hsla(${hue + 30}, 100%, 70%, 0.6)`);
      ctx.fillStyle = gradTop;
      ctx.fillRect(x, centerY - barHeight, barWidth, barHeight);

      // Нижняя половина (зеркало, чуть темнее)
      const gradBot = ctx.createLinearGradient(0, centerY, 0, centerY + barHeight);
      gradBot.addColorStop(0, `hsla(${hue}, 90%, 45%, 0.7)`);
      gradBot.addColorStop(1, `hsla(${hue + 30}, 100%, 30%, 0.1)`);
      ctx.fillStyle = gradBot;
      ctx.fillRect(x, centerY, barWidth, barHeight);

      // Верхушка — яркая полоска
      if (value > 0.2) {
        ctx.fillStyle = `hsla(${hue + 30}, 100%, 90%, 0.8)`;
        ctx.fillRect(x, centerY - barHeight, barWidth, 2);
      }
    }

    // Центральная линия
    ctx.beginPath();
    ctx.moveTo(0, centerY); ctx.lineTo(width, centerY);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1; ctx.stroke();
  };

  // 13. Plasma — живое переливающееся пятно
  const drawPlasma = (ctx: CanvasRenderingContext2D, width: number, height: number, dataArray: Uint8Array, sensitivity: number, time: number) => {
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
    const avg = (sum / dataArray.length / 255) * sensitivity;

    const blobs = 5;
    for (let b = 0; b < blobs; b++) {
      const x = width * (0.5 + Math.sin(time * (0.3 + b * 0.15) + b * 2) * 0.35);
      const y = height * (0.5 + Math.cos(time * (0.2 + b * 0.1) + b) * 0.35);
      const radius = Math.min(width, height) * (0.15 + avg * 0.25 + Math.sin(time + b) * 0.05);

      const hue = (time * 20 + b * 72) % 360;
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
      gradient.addColorStop(0, `hsla(${hue}, 100%, 65%, ${0.25 + avg * 0.35})`);
      gradient.addColorStop(0.5, `hsla(${(hue + 30) % 360}, 90%, 50%, ${0.1 + avg * 0.2})`);
      gradient.addColorStop(1, `hsla(${(hue + 60) % 360}, 80%, 40%, 0)`);

      ctx.globalCompositeOperation = "screen";
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = gradient;
      ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
  };

  // 14. Oscilloscope — тонкая белая линия осциллографа
  const drawOscilloscope = (ctx: CanvasRenderingContext2D, width: number, height: number, dataArray: Uint8Array, sensitivity: number) => {
    const centerY = height / 2;
    const sliceWidth = width / dataArray.length;

    // Фоновая сетка
    ctx.strokeStyle = "rgba(0, 255, 100, 0.06)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (height / 4) * i;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
    }
    for (let i = 0; i <= 8; i++) {
      const x = (width / 8) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
    }

    // Основная линия
    ctx.beginPath();
    let x = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const v = (dataArray[i] - 128) / 128;
      const y = centerY + v * centerY * 0.85 * sensitivity;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      x += sliceWidth;
    }

    ctx.strokeStyle = "rgba(0, 255, 100, 0.9)";
    ctx.lineWidth = 1.5;
    ctx.shadowBlur = 6;
    ctx.shadowColor = "rgba(0, 255, 100, 0.6)";
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Текст как на старом осциллографе
    ctx.font = "10px monospace";
    ctx.fillStyle = "rgba(0, 255, 100, 0.35)";
    ctx.fillText("CH1", 8, 14);
    ctx.fillText("1ms/div", width - 55, 14);
  };

  // ─── ОБРАБОТКА СОБЫТИЙ ────────────────────────────────────────────────────

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    onSeek(Math.max(0, Math.min(1, x / rect.width)));
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !onSeek) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
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
