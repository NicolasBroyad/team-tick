// Sonido de "tarea completada": un "tic" corto seguido de una campanita de
// dos notas ascendentes. Se sintetiza con Web Audio, sin archivos de audio.

let context: AudioContext | null = null;

function getContext() {
  if (typeof window === "undefined") return null;
  const AudioCtx =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext;
  if (!AudioCtx) return null;
  context ??= new AudioCtx();
  // El audio arranca suspendido hasta que hay un gesto del usuario (el clic).
  if (context.state === "suspended") void context.resume();
  return context;
}

// Nota con ataque rápido y caída exponencial. Un armónico suave encima hace
// que suene a campanita y no a pitido.
function bell(
  ctx: AudioContext,
  output: AudioNode,
  frequency: number,
  start: number,
  duration: number,
  volume: number,
) {
  const envelope = ctx.createGain();
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(volume, start + 0.004);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  envelope.connect(output);

  for (const [ratio, level] of [
    [1, 1],
    [2, 0.15],
    [3, 0.04],
  ]) {
    const oscillator = ctx.createOscillator();
    oscillator.frequency.value = frequency * ratio;
    const partial = ctx.createGain();
    partial.gain.value = level;
    oscillator.connect(partial).connect(envelope);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.05);
  }
}

// Ráfaga de ruido muy corta y filtrada: el "tic" del tilde.
function click(ctx: AudioContext, output: AudioNode, start: number) {
  const length = Math.floor(ctx.sampleRate * 0.012);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
  }
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  const filter = ctx.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 3200;
  filter.Q.value = 1.2;
  const gain = ctx.createGain();
  gain.gain.value = 0.6;
  source.connect(filter).connect(gain).connect(output);
  source.start(start);
}

export function playTaskDoneSound() {
  try {
    const ctx = getContext();
    if (!ctx) return;
    const now = ctx.currentTime + 0.01;
    const master = ctx.createGain();
    master.gain.value = 0.6;
    master.connect(ctx.destination);

    click(ctx, master, now);
    bell(ctx, master, 1046.5, now + 0.01, 0.22, 0.5); // Do6
    bell(ctx, master, 1568, now + 0.085, 0.5, 0.45); // Sol6
  } catch {
    // Si el navegador no soporta audio, simplemente no suena.
  }
}
