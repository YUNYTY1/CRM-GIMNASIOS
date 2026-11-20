let ctx: AudioContext | null = null

/** Debe llamarse desde un gesto del usuario (clic) para que el navegador permita audio. */
export function desbloquearAudio(): void {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    ctx = ctx ?? new AC()
    if (ctx.state === 'suspended') void ctx.resume()
  } catch {
    /* sin audio disponible */
  }
}

function tono(freq: number, inicio: number, dur: number, tipo: OscillatorType, vol = 0.25): void {
  if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = tipo
  osc.frequency.value = freq
  const t0 = ctx.currentTime + inicio
  gain.gain.setValueAtTime(0.0001, t0)
  gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t0)
  osc.stop(t0 + dur + 0.05)
}

export function sonidoPermitido(): void {
  tono(660, 0, 0.14, 'sine')
  tono(990, 0.15, 0.28, 'sine')
}

export function sonidoDenegado(): void {
  tono(180, 0, 0.35, 'sawtooth', 0.3)
  tono(140, 0.4, 0.45, 'sawtooth', 0.3)
}

export function sonidoAviso(): void {
  tono(520, 0, 0.18, 'triangle')
}
