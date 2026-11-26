# Original startup chime for Yapstats: a soft D-flat major chord with an added ninth that blooms upward and rings out.
# Synthesised from sine partials only; no samples, nothing copied from any other sound.
import numpy as np, wave
sr = 44100; dur = 2.2; n = int(sr * dur); t = np.arange(n) / sr
rng = np.random.default_rng(7)
# (frequency Hz, level, onset s, decay time s, pan -1..1)
notes = [
    (138.59, 0.55, 0.000, 1.00, -0.10),  # Db3
    (207.65, 0.50, 0.018, 0.90,  0.15),  # Ab3
    (277.18, 0.62, 0.036, 0.78, -0.25),  # Db4
    (349.23, 0.56, 0.056, 0.70,  0.30),  # F4
    (415.30, 0.48, 0.078, 0.64, -0.35),  # Ab4
    (622.25, 0.34, 0.104, 0.55,  0.40),  # Eb5, the ninth: the lift at the top
    (830.61, 0.14, 0.130, 0.45,  0.00),  # Ab5, a faint shimmer
]
left = np.zeros(n); right = np.zeros(n)
for f, level, onset, decay, pan in notes:
    tt = np.clip(t - onset, 0, None)
    attack = 0.5 - 0.5 * np.cos(np.pi * np.clip(tt / 0.022, 0, 1))   # 22 ms raised-cosine: soft, no click
    env = attack * np.exp(-tt / decay) * (t >= onset)
    tone = np.zeros(n)
    for k, amp in enumerate([1.0, 0.42, 0.16, 0.07, 0.03], start=1):   # mellow: upper partials fall away fast
        if f * k > 9000: break
        for cents in (-2.5, 2.5):                                      # two voices a few cents apart: gentle width
            fk = f * k * 2 ** (cents / 1200) * (1 + 0.0004 * k * k)    # a touch of bell-like stretch
            tone += amp * 0.5 * np.sin(2 * np.pi * fk * tt + rng.uniform(0, 2 * np.pi)) * np.exp(-tt * (k - 1) * 1.6)
    sig = level * env * tone
    left += sig * np.sqrt((1 - pan) / 2); right += sig * np.sqrt((1 + pan) / 2)
# A short, dark room: filtered noise with an exponential tail, mixed in quietly.
ir_n = int(sr * 1.1); ir_t = np.arange(ir_n) / sr
def room(seed):
    noise = np.random.default_rng(seed).standard_normal(ir_n) * np.exp(-ir_t / 0.32)
    spec = np.fft.rfft(noise); freqs = np.fft.rfftfreq(ir_n, 1 / sr)
    spec *= 1 / (1 + (freqs / 3200) ** 2)                              # roll off the highs
    return np.fft.irfft(spec, ir_n)
def wet(x, seed):
    y = np.fft.irfft(np.fft.rfft(x, n + ir_n) * np.fft.rfft(room(seed), n + ir_n))[:n]
    return y / (np.max(np.abs(y)) + 1e-9)
mixL = left + 0.16 * np.max(np.abs(left)) * wet(left, 1); mixR = right + 0.16 * np.max(np.abs(right)) * wet(right, 2)
fade = np.ones(n); tail = int(sr * 0.5); fade[-tail:] = 0.5 + 0.5 * np.cos(np.pi * np.arange(tail) / tail)
out = np.stack([mixL, mixR], axis=1) * fade[:, None]
out *= 10 ** (-8 / 20) / np.max(np.abs(out))                           # peak at -8 dBFS: present, never loud
pcm = (out * 32767).astype('<i2')
with wave.open('startup.wav', 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes(pcm.tobytes())
rms = 20 * np.log10(np.sqrt(np.mean(out ** 2)))
print('peak dBFS %.1f, rms dBFS %.1f, first sample %.5f, last sample %.5f, clipped %d' % (20 * np.log10(np.max(np.abs(out))), rms, abs(out[0]).max(), abs(out[-1]).max(), int((np.abs(pcm) >= 32767).sum())))
spec = np.abs(np.fft.rfft(out.mean(axis=1) * np.hanning(n))); fr = np.fft.rfftfreq(n, 1 / sr)
top = fr[np.argsort(spec)[-6:]]; print('strongest partials Hz:', sorted(int(x) for x in top))
print('energy above 5 kHz: %.2f%%' % (100 * (spec[fr > 5000] ** 2).sum() / (spec ** 2).sum()))
e = np.abs(out).max(axis=1); print('time to 10%% of peak: %.2fs' % (np.where(e > 0.1 * e.max())[0][-1] / sr))
