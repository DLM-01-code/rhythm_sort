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
  const timeRef = useRef(0);
  const smoothDataRef = useRef<Uint8Array | null>(null);
  const smoothFreqRef = useRef<Float32Array | null>(null);
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
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
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

    if (!smoothDataRef.current || smoothDataRef.current.length !== bufferLength) {
      smoothDataRef.current = new Uint8Array(bufferLength);
    }
    if (!smoothFreqRef.current || smoothFreqRef.current.length !== bufferLength) {
      smoothFreqRef.current = new Float32Array(bufferLength);
    }

    let frameCount = 0;
    const frameInterval = perfMode ? 2 : 1;
    let lastBassAvg = 0;

    const draw = () => {
      frameCount++;
      if (perfMode && frameCount % frameInterval !== 0) {
        animationRef.current = requestAnimationFrame(draw);
        return;
      }

      analyser.getByteFrequencyData(freqArray);
      analyser.getByteTimeDomainData(timeArray);

      // Smooth time domain
      for (let i = 0; i < bufferLength; i++) {
        smoothDataRef.current![i] = smoothDataRef.current![i] * (1 - smoothingFactor) + timeArray[i] * smoothingFactor;
      }
      // Smooth freq domain
      for (let i = 0; i < bufferLength; i++) {
        smoothFreqRef.current![i] = smoothFreqRef.current![i] * 0.8 + (freqArray[i] / 255) * 0.2;
      }

      timeRef.current += 0.02;

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = "#0f1117";
      ctx.fillRect(0, 0, width, height);

      const sm = smoothDataRef.current!;
      const sf = smoothFreqRef.current!;
      const t = timeRef.current;

      switch (mode) {
        case "dual_waveform":   drawDualWaveform(ctx, width, height, sm, sensitivity); break;
        case "rms_meter":       drawRmsMeter(ctx, width, height, freqArray, sensitivity); break;
        case "aurora":          drawAurora(ctx, width, height, freqArray, sensitivity, t); break;
        case "vu_meter":        drawVuMeter(ctx, width, height, freqArray, sensitivity); break;
        case "lissajous":       drawLissajous(ctx, width, height, timeArray, sensitivity); break;
        case "wave":            drawWave(ctx, width, height, sm, sensitivity); break;
        case "particle_flow":   drawParticleFlow(ctx, width, height, sf, sensitivity, t); break;
        case "dna_helix":       drawDnaHelix(ctx, width, height, sf, sensitivity, t); break;
        case "ink_drop":        drawInkDrop(ctx, width, height, sf, sensitivity, t); break;
        case "city_lights":     drawCityLights(ctx, width, height, freqArray, sensitivity, t); break;
        case "neon_ring":       drawNeonRing(ctx, width, height, freqArray, sensitivity, t); break;
        case "mirror_bars":     drawMirrorBars(ctx, width, height, freqArray, sensitivity); break;
        case "plasma":          drawPlasma(ctx, width, height, sf, sensitivity, t); break;
        case "oscilloscope":    drawOscilloscope(ctx, width, height, timeArray, sensitivity); break;
        default:                drawDualWaveform(ctx, width, height, sm, sensitivity);
      }

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => { if (animationRef.current) cancelAnimationFrame(animationRef.current); clearCanvas(); };
  }, [analyser, enabled, mode, sensitivity, perfMode]);

  useEffect(() => {
    clearCanvas();
    plasmaOrbsRef.current = null;
  }, [mode]);

  // ── 1. Dual Waveform ──────────────────────────────────────────────────────────
  const drawDualWaveform = (ctx: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array, sens: number) => {
    const sw = w / data.length;
    [[h / 4, "#3b82f6"], [h * 0.75, "#f97316"]].forEach(([yBase, color]) => {
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const v = (data[i] - 128) / 128;
        const y = v * h * 0.25 * sens + (yBase as number);
        i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * sw, y);
      }
      ctx.strokeStyle = color as string; ctx.lineWidth = 2; ctx.stroke();
    });
    ctx.beginPath(); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2);
    ctx.strokeStyle = "rgba(255,255,255,0.1)"; ctx.lineWidth = 1; ctx.stroke();
  };

  // ── 2. RMS Meter ─────────────────────────────────────────────────────────────
  const drawRmsMeter = (ctx: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array, sens: number) => {
    let sum = 0; for (let i = 0; i < data.length; i++) sum += data[i];
    const rms = Math.min(1, (sum / data.length / 255) * sens);
    const mx = 20, mw = w - 40, mh = 20, my = h / 2 - 10;
    ctx.fillStyle = "#1e1e2e"; ctx.fillRect(mx, my, mw, mh);
    const color = rms < 0.6 ? "#22c55e" : rms < 0.8 ? "#eab308" : "#ef4444";
    ctx.fillStyle = color; ctx.fillRect(mx, my, mw * rms, mh);
    ctx.font = "bold 20px monospace"; ctx.fillStyle = color;
    ctx.fillText(`${Math.floor(rms * 100)}%`, w / 2 - 30, my - 10);
  };

  // ── 3. Aurora ────────────────────────────────────────────────────────────────
  const drawAurora = (ctx: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array, sens: number, t: number) => {
    for (let i = 0; i < data.length; i++) {
      const val = data[i] / 255;
      const bh = val * h * 0.5 * sens;
      const hue = (t * 20 + i * 0.5) % 360;
      const grad = ctx.createLinearGradient(0, h, 0, h - bh);
      grad.addColorStop(0, `hsla(${hue},100%,50%,${0.3 + val * 0.5})`);
      grad.addColorStop(1, `hsla(${hue + 40},100%,30%,0.05)`);
      ctx.fillStyle = grad;
      ctx.fillRect(i * (w / data.length), h - bh, w / data.length + 1, bh);
    }
    for (let i = 0; i < 50; i++) {
      const sx = (Math.sin(i * 100 + t) * 0.5 + 0.5) * w;
      const sy = (Math.cos(i * 50 + t * 0.5) * 0.3 + 0.3) * h;
      ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(t + i) * 0.2})`;
      ctx.fillRect(sx, sy, 1.5, 1.5);
    }
  };

  // ── 4. VU Meter ──────────────────────────────────────────────────────────────
  const drawVuMeter = (ctx: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array, sens: number) => {
    let sum = 0; for (let i = 0; i < data.length; i++) sum += data[i];
    const level = Math.min(1, (sum / data.length / 255) * sens);
    const n = 20, ls = 15, sp = 8;
    const sx = (w - n * (ls + sp)) / 2, y = h / 2 - ls / 2;
    const lit = Math.floor(level * n);
    for (let i = 0; i < n; i++) {
      const x = sx + i * (ls + sp);
      const color = i < n * 0.6 ? "#22c55e" : i < n * 0.8 ? "#eab308" : "#ef4444";
      ctx.fillStyle = i < lit ? color : "#1e1e2e"; ctx.fillRect(x, y, ls, ls);
      if (i < lit) { ctx.shadowBlur = 8; ctx.shadowColor = color; ctx.fillRect(x, y, ls, ls); ctx.shadowBlur = 0; }
    }
  };

  // ── 5. Lissajous ─────────────────────────────────────────────────────────────
  const drawLissajous = (ctx: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array, sens: number) => {
    const cx = w / 2, cy = h / 2, r = Math.min(w, h) / 3 * sens;
    const half = Math.floor(data.length / 2);
    ctx.beginPath();
    for (let i = 0; i < half; i++) {
      const x = cx + ((data[i] - 128) / 128) * r;
      const y = cy + ((data[i + half] - 128) / 128) * r;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "#00ff88"; ctx.lineWidth = 1.5; ctx.stroke();
  };

  // ── 6. Wave ──────────────────────────────────────────────────────────────────
  const drawWave = (ctx: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array, sens: number) => {
    const yOff = h * 0.65, sw = w / data.length;
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const y = yOff + ((data[i] - 128) / 128) * h * 0.3 * sens;
      i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * sw, y);
    }
    ctx.strokeStyle = "#3b82f6"; ctx.lineWidth = 2.5; ctx.stroke();
    ctx.lineTo(w, h); ctx.lineTo(0, h); ctx.closePath();
    const g = ctx.createLinearGradient(0, yOff - 10, 0, h);
    g.addColorStop(0, "rgba(59,130,246,0.15)"); g.addColorStop(1, "rgba(59,130,246,0)");
    ctx.fillStyle = g; ctx.fill();
  };

  // ── 7. Particle Flow ─────────────────────────────────────────────────────────
  const drawParticleFlow = (ctx: CanvasRenderingContext2D, w: number, h: number, data: Float32Array, sens: number, t: number) => {
    const n = Math.min(data.length, 128);
    for (let i = 0; i < n; i++) {
      const val = data[i] * sens;
      const angle = (i / n) * Math.PI * 2 + t * 0.5;
      const radius = (0.1 + val * 0.4) * Math.min(w, h);
      const x = w / 2 + Math.cos(angle) * radius;
      const y = h / 2 + Math.sin(angle) * radius;
      const size = 1 + val * 6;
      const hue = (i / n * 360 + t * 30) % 360;
      ctx.fillStyle = `hsla(${hue},100%,70%,${0.4 + val * 0.6})`;
      ctx.beginPath(); ctx.arc(x, y, size, 0, Math.PI * 2); ctx.fill();
    }
    // Center glow
    const cg = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, 60);
    cg.addColorStop(0, `hsla(${(t * 40) % 360},100%,70%,0.15)`);
    cg.addColorStop(1, "transparent");
    ctx.fillStyle = cg; ctx.fillRect(0, 0, w, h);
  };

  // ── 8. DNA Helix ─────────────────────────────────────────────────────────────
  const drawDnaHelix = (ctx: CanvasRenderingContext2D, w: number, h: number, data: Float32Array, sens: number, t: number) => {
    const n = Math.min(data.length, 200);
    const cy = h / 2, amp = h * 0.35;
    for (let i = 0; i < n; i++) {
      const x = (i / n) * w;
      const phase = (i / n) * Math.PI * 6 + t;
      const val = data[i] * sens;
      const y1 = cy + Math.sin(phase) * amp * (0.3 + val);
      const y2 = cy + Math.sin(phase + Math.PI) * amp * (0.3 + val);
      const hue1 = (i / n * 200 + t * 20) % 360;
      const hue2 = (hue1 + 120) % 360;
      // Strand 1
      ctx.beginPath(); ctx.arc(x, y1, 2 + val * 4, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue1},100%,65%,0.9)`; ctx.fill();
      // Strand 2
      ctx.beginPath(); ctx.arc(x, y2, 2 + val * 4, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue2},100%,65%,0.9)`; ctx.fill();
      // Rungs
      if (i % 12 === 0) {
        ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x, y2);
        ctx.strokeStyle = `rgba(255,255,255,${0.1 + val * 0.3})`; ctx.lineWidth = 1; ctx.stroke();
      }
    }
  };

  // ── 9. Ink Drop ──────────────────────────────────────────────────────────────
  const inkParticlesRef = useRef<Array<{x:number;y:number;vx:number;vy:number;life:number;hue:number;size:number}>>([]);
  const drawInkDrop = (ctx: CanvasRenderingContext2D, w: number, h: number, data: Float32Array, sens: number, t: number) => {
    ctx.fillStyle = "rgba(15,17,23,0.15)"; ctx.fillRect(0, 0, w, h);
    const energy = data.slice(0, 32).reduce((a, b) => a + b, 0) / 32 * sens;
    // Spawn new particles
    const spawn = Math.floor(energy * 8);
    for (let i = 0; i < spawn; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 0.5 + Math.random() * 3 * energy;
      inkParticlesRef.current.push({
        x: w / 2 + (Math.random() - 0.5) * 40,
        y: h / 2 + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 1,
        hue: (t * 30 + Math.random() * 60) % 360,
        size: 1 + Math.random() * 4 * energy,
      });
    }
    // Update & draw
    inkParticlesRef.current = inkParticlesRef.current.filter(p => p.life > 0.02);
    for (const p of inkParticlesRef.current) {
      p.x += p.vx; p.y += p.vy;
      p.vx *= 0.97; p.vy *= 0.97;
      p.life -= 0.02;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${p.hue},80%,60%,${p.life * 0.8})`; ctx.fill();
    }
    if (inkParticlesRef.current.length > 500) inkParticlesRef.current = inkParticlesRef.current.slice(-500);
  };

  // ── 10. City Lights ──────────────────────────────────────────────────────────
  const drawCityLights = (ctx: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array, sens: number, t: number) => {
    const n = Math.min(data.length, 64);
    const bw = w / n;
    for (let i = 0; i < n; i++) {
      const val = (data[i] / 255) * sens;
      const bh = val * h * 0.8;
      const x = i * bw;
      // Building
      ctx.fillStyle = `rgba(20,25,40,0.95)`; ctx.fillRect(x + 1, h - bh, bw - 2, bh);
      // Windows
      const floors = Math.floor(bh / 12);
      for (let f = 0; f < floors; f++) {
        const wy = h - (f + 1) * 12;
        const lit = Math.random() > 0.3;
        if (lit) {
          const hue = 40 + Math.floor(i / n * 40);
          ctx.fillStyle = `hsla(${hue},100%,80%,0.9)`;
          ctx.fillRect(x + 3, wy + 2, bw - 6, 7);
          ctx.shadowBlur = 4; ctx.shadowColor = `hsla(${hue},100%,80%,0.5)`;
          ctx.fillRect(x + 3, wy + 2, bw - 6, 7);
          ctx.shadowBlur = 0;
        }
      }
      // Rooftop light
      if (val > 0.5) {
        ctx.beginPath(); ctx.arc(x + bw / 2, h - bh - 3, 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,80,80,0.9)`; ctx.fill();
      }
    }
    // Reflection in water
    const rg = ctx.createLinearGradient(0, h * 0.85, 0, h);
    rg.addColorStop(0, "rgba(10,15,30,0.5)"); rg.addColorStop(1, "rgba(5,8,20,0.8)");
    ctx.fillStyle = rg; ctx.fillRect(0, h * 0.85, w, h * 0.15);
  };

  // ── 11. Neon Ring ────────────────────────────────────────────────────────────
  const drawNeonRing = (ctx: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array, sens: number, t: number) => {
    const cx = w / 2, cy = h / 2;
    const baseR = Math.min(w, h) * 0.25;
    const n = Math.min(data.length, 256);
    ctx.save();
    for (let ring = 0; ring < 3; ring++) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const angle = (i / n) * Math.PI * 2 - Math.PI / 2;
        const val = (data[i % n] / 255) * sens;
        const r = baseR * (1 + ring * 0.3) + val * 40;
        const x = cx + Math.cos(angle + t * (ring + 1) * 0.2) * r;
        const y = cy + Math.sin(angle + t * (ring + 1) * 0.2) * r;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      const hue = (t * 30 + ring * 120) % 360;
      ctx.strokeStyle = `hsla(${hue},100%,60%,0.8)`;
      ctx.lineWidth = 2;
      ctx.shadowBlur = 12; ctx.shadowColor = `hsla(${hue},100%,60%,1)`;
      ctx.stroke(); ctx.shadowBlur = 0;
    }
    ctx.restore();
  };

  // ── 12. Mirror Bars ──────────────────────────────────────────────────────────
  const drawMirrorBars = (ctx: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array, sens: number) => {
    const n = Math.min(data.length, 128);
    const bw = w / n;
    const cy = h / 2;
    for (let i = 0; i < n; i++) {
      const val = (data[i] / 255) * sens;
      const bh = val * cy * 0.9;
      const x = i * bw;
      const hue = (i / n) * 240 + 180;
      const g = ctx.createLinearGradient(0, cy - bh, 0, cy + bh);
      g.addColorStop(0, `hsla(${hue},100%,70%,0.2)`);
      g.addColorStop(0.5, `hsla(${hue},100%,70%,0.9)`);
      g.addColorStop(1, `hsla(${hue},100%,70%,0.2)`);
      ctx.fillStyle = g; ctx.fillRect(x + 1, cy - bh, bw - 2, bh * 2);
      // Glow line at center
      ctx.fillStyle = `hsla(${hue},100%,90%,0.8)`; ctx.fillRect(x + 1, cy - 1, bw - 2, 2);
    }
  };

  // ── 13. Plasma (летающие светящиеся шары) ────────────────────────────────────
  const plasmaOrbsRef = useRef<Array<{
    x: number; y: number; vx: number; vy: number;
    hue: number; baseSize: number; freqBin: number;
  }> | null>(null);

  const drawPlasma = (ctx: CanvasRenderingContext2D, w: number, h: number, data: Float32Array, sens: number, t: number) => {
    const ORB_COUNT = 6;

    // Инициализируем шары один раз
    if (!plasmaOrbsRef.current) {
      plasmaOrbsRef.current = Array.from({ length: ORB_COUNT }, (_, i) => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.8,
        vy: (Math.random() - 0.5) * 0.8,
        hue: (i / ORB_COUNT) * 360,
        baseSize: 45 + Math.random() * 30,
        freqBin: Math.floor((i / ORB_COUNT) * Math.min(data.length - 1, 60)),
      }));
    }

    const orbs = plasmaOrbsRef.current;

    // Обновляем и рисуем каждый шар
    for (const orb of orbs) {
      // Двигаем
      orb.x += orb.vx;
      orb.y += orb.vy;
      // Отскок от краёв
      if (orb.x < 0 || orb.x > w) orb.vx *= -1;
      if (orb.y < 0 || orb.y > h) orb.vy *= -1;
      orb.x = Math.max(0, Math.min(w, orb.x));
      orb.y = Math.max(0, Math.min(h, orb.y));

      // Размер пульсирует от частоты
      const freq = data[orb.freqBin] ?? 0;
      const pulse = 1 + freq * sens * 1.2;
      const size = orb.baseSize * pulse;

      // Цвет медленно дрейфует
      orb.hue = (orb.hue + 0.3) % 360;

      // Рисуем мягкий градиентный шар
      const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, size);
      grad.addColorStop(0,   `hsla(${orb.hue}, 100%, 75%, ${0.55 + freq * 0.4})`);
      grad.addColorStop(0.4, `hsla(${orb.hue}, 100%, 55%, ${0.25 + freq * 0.2})`);
      grad.addColorStop(1,   `hsla(${orb.hue}, 100%, 30%, 0)`);

      ctx.beginPath();
      ctx.arc(orb.x, orb.y, size, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  };

  // ── 14. Oscilloscope ─────────────────────────────────────────────────────────
  const drawOscilloscope = (ctx: CanvasRenderingContext2D, w: number, h: number, data: Uint8Array, sens: number) => {
    const sw = w / data.length;
    const cy = h / 2;
    // Grid
    ctx.strokeStyle = "rgba(0,255,0,0.1)"; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = (i / 4) * h;
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    for (let i = 0; i <= 8; i++) {
      const x = (i / 8) * w;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
    }
    // Signal
    ctx.beginPath();
    for (let i = 0; i < data.length; i++) {
      const y = cy + ((data[i] - 128) / 128) * cy * sens;
      i === 0 ? ctx.moveTo(0, y) : ctx.lineTo(i * sw, y);
    }
    ctx.strokeStyle = "#00ff00"; ctx.lineWidth = 1.5;
    ctx.shadowBlur = 6; ctx.shadowColor = "#00ff00";
    ctx.stroke(); ctx.shadowBlur = 0;
    // Labels
    ctx.font = "10px monospace"; ctx.fillStyle = "rgba(0,255,0,0.5)";
    ctx.fillText("+1.0", 4, 14); ctx.fillText("0.0", 4, h / 2 + 4); ctx.fillText("-1.0", 4, h - 4);
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!onSeek) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    onSeek(Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)));
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
