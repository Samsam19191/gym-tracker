let ctx: AudioContext | null = null;

type AudioCtor = typeof AudioContext;

/** iOS only plays Web Audio after a tap has "unlocked" it, so call this from tap handlers. */
export function unlockAudio(): void {
  try {
    if (!ctx) {
      const Ctor: AudioCtor | undefined = window.AudioContext ?? (window as unknown as { webkitAudioContext?: AudioCtor }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
    }
    if (ctx.state === 'suspended') void ctx.resume();
    const buffer = ctx.createBuffer(1, 1, 22050);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.connect(ctx.destination);
    src.start(0);
  } catch {
    /* audio unavailable: the visual cue still works */
  }
}

function tone(c: AudioContext, freq: number, at: number, length: number) {
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(0.5, at + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(c.destination);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

/** Two short rising tones. */
export function playRestBeep(): void {
  if (!ctx) return;
  try {
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime + 0.01;
    tone(ctx, 880, t, 0.16);
    tone(ctx, 1320, t + 0.2, 0.26);
  } catch {
    /* ignore */
  }
}
