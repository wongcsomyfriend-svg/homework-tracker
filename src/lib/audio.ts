let ctx: AudioContext | null = null

export function unlockAudio() {
  if (!ctx) {
    ctx = new AudioContext()
  }
  if (ctx.state === 'suspended') {
    void ctx.resume()
  }
  return ctx
}

/** Short “ding” when a scan completes. Must call unlockAudio() on a user gesture first. */
export function playDing() {
  const audio = unlockAudio()
  const now = audio.currentTime
  const gain = audio.createGain()
  gain.gain.setValueAtTime(0.0001, now)
  gain.gain.exponentialRampToValueAtTime(0.35, now + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45)
  gain.connect(audio.destination)

  const osc1 = audio.createOscillator()
  osc1.type = 'sine'
  osc1.frequency.setValueAtTime(880, now)
  osc1.frequency.exponentialRampToValueAtTime(1320, now + 0.12)
  osc1.connect(gain)
  osc1.start(now)
  osc1.stop(now + 0.45)

  const osc2 = audio.createOscillator()
  osc2.type = 'triangle'
  osc2.frequency.setValueAtTime(1320, now + 0.08)
  osc2.connect(gain)
  osc2.start(now + 0.08)
  osc2.stop(now + 0.5)

  try {
    navigator.vibrate?.([40, 40, 80])
  } catch {
    /* iOS has no vibrate */
  }
}
