/**
 * Generate a lofi background music loop as a WAV file.
 * Run with: node scripts/generate-audio.js
 *
 * Creates a ~16-second seamless lofi loop with:
 * - Mellow chord progression (Cmaj7 → Am7 → Fmaj7 → G7)
 * - Soft sine/triangle pads
 * - Light vinyl crackle texture
 * - ~70 BPM tempo
 */

const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 22050; // Lower sample rate is fine for lofi aesthetic
const BPM = 70;
const BEAT_SEC = 60 / BPM;
const BARS = 4;
const BEATS_PER_BAR = 4;
const DURATION = BARS * BEATS_PER_BAR * BEAT_SEC; // ~13.7 seconds
const NUM_SAMPLES = Math.floor(DURATION * SAMPLE_RATE);

// Note frequencies (Hz)
const NOTE = {
    C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
    C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
    C5: 523.25, D5: 587.33, E5: 659.25,
};

// Chord voicings (frequencies) — jazz voicings
const CHORDS = [
    // Cmaj7: C E G B
    [NOTE.C3, NOTE.E3, NOTE.G3, NOTE.B3, NOTE.E4],
    // Am7: A C E G
    [NOTE.A3, NOTE.C4, NOTE.E4, NOTE.G4, NOTE.C5],
    // Fmaj7: F A C E
    [NOTE.F3, NOTE.A3, NOTE.C4, NOTE.E4, NOTE.A4],
    // G7: G B D F
    [NOTE.G3, NOTE.B3, NOTE.D4, NOTE.F4, NOTE.B4],
];

// Simple melody notes (pentatonic, one per beat)
const MELODY = [
    NOTE.E5, 0, NOTE.D5, NOTE.C5,
    NOTE.A4, NOTE.C5, 0, NOTE.G4,
    NOTE.A4, 0, NOTE.C5, NOTE.E5,
    NOTE.D5, NOTE.B4, 0, NOTE.G4,
];

function sine(phase) {
    return Math.sin(2 * Math.PI * phase);
}

function triangle(phase) {
    const p = phase % 1;
    return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
}

// Soft attack-decay envelope
function envelope(t, duration, attack = 0.05, release = 0.3) {
    if (t < attack) return t / attack;
    if (t > duration - release) return Math.max(0, (duration - t) / release);
    return 1;
}

// Generate audio samples
const samples = new Float32Array(NUM_SAMPLES);

for (let i = 0; i < NUM_SAMPLES; i++) {
    const t = i / SAMPLE_RATE;
    const beatIndex = Math.floor(t / BEAT_SEC);
    const barIndex = Math.floor(beatIndex / BEATS_PER_BAR);
    const chord = CHORDS[barIndex % CHORDS.length];
    const beatInBar = beatIndex % BEATS_PER_BAR;
    const timeInBeat = t - beatIndex * BEAT_SEC;

    let sample = 0;

    // ─── Pad layer (sustained chords, soft triangle waves) ───
    for (const freq of chord) {
        const env = envelope(timeInBeat, BEAT_SEC, 0.1, 0.2);
        sample += triangle(freq * t) * 0.04 * env;
    }

    // ─── Bass note (root of chord, sine wave) ───
    const bassFreq = chord[0] / 2; // One octave below root
    const bassEnv = envelope(timeInBeat, BEAT_SEC, 0.02, 0.4);
    sample += sine(bassFreq * t) * 0.1 * bassEnv;

    // ─── Melody (soft sine, one note per beat) ───
    const melodyNote = MELODY[beatIndex % MELODY.length];
    if (melodyNote > 0) {
        const melEnv = envelope(timeInBeat, BEAT_SEC, 0.03, 0.5);
        sample += sine(melodyNote * t) * 0.06 * melEnv;
        // Add slight detuned layer for warmth
        sample += sine(melodyNote * 1.002 * t) * 0.025 * melEnv;
    }

    // ─── Vinyl crackle (filtered noise) ───
    if (Math.random() < 0.03) {
        sample += (Math.random() - 0.5) * 0.015;
    }

    // ─── Subtle kick on beats 1 and 3 ───
    if (beatInBar === 0 || beatInBar === 2) {
        const kickT = timeInBeat;
        if (kickT < 0.15) {
            const kickFreq = 60 * Math.exp(-kickT * 20);
            const kickEnv = Math.exp(-kickT * 25);
            sample += sine(kickFreq * kickT) * 0.08 * kickEnv;
        }
    }

    // ─── Hi-hat on off-beats (noise burst) ───
    if (beatInBar === 1 || beatInBar === 3) {
        if (timeInBeat < 0.03) {
            sample += (Math.random() - 0.5) * 0.04 * (1 - timeInBeat / 0.03);
        }
    }

    // Soft clamp
    samples[i] = Math.max(-0.8, Math.min(0.8, sample));
}

// ─── Apply fade-in/out for seamless looping ───
const fadeSamples = Math.floor(0.05 * SAMPLE_RATE); // 50ms crossfade
for (let i = 0; i < fadeSamples; i++) {
    const fade = i / fadeSamples;
    samples[i] *= fade;
    samples[NUM_SAMPLES - 1 - i] *= fade;
}

// ─── Apply simple low-pass filter for lofi warmth ───
const filtered = new Float32Array(NUM_SAMPLES);
const alpha = 0.35; // Lower = more filtering
filtered[0] = samples[0];
for (let i = 1; i < NUM_SAMPLES; i++) {
    filtered[i] = filtered[i - 1] + alpha * (samples[i] - filtered[i - 1]);
}

// ─── Write WAV file ───
function writeWav(filePath, sampleData, sampleRate) {
    const numSamples = sampleData.length;
    const bitsPerSample = 16;
    const byteRate = sampleRate * 2; // 16-bit mono
    const dataSize = numSamples * 2;
    const fileSize = 44 + dataSize;

    const buffer = Buffer.alloc(fileSize);
    let offset = 0;

    // RIFF header
    buffer.write('RIFF', offset); offset += 4;
    buffer.writeUInt32LE(fileSize - 8, offset); offset += 4;
    buffer.write('WAVE', offset); offset += 4;

    // fmt chunk
    buffer.write('fmt ', offset); offset += 4;
    buffer.writeUInt32LE(16, offset); offset += 4;        // chunk size
    buffer.writeUInt16LE(1, offset); offset += 2;          // PCM format
    buffer.writeUInt16LE(1, offset); offset += 2;          // mono
    buffer.writeUInt32LE(sampleRate, offset); offset += 4;
    buffer.writeUInt32LE(byteRate, offset); offset += 4;
    buffer.writeUInt16LE(2, offset); offset += 2;          // block align
    buffer.writeUInt16LE(bitsPerSample, offset); offset += 2;

    // data chunk
    buffer.write('data', offset); offset += 4;
    buffer.writeUInt32LE(dataSize, offset); offset += 4;

    // Write 16-bit PCM samples
    for (let i = 0; i < numSamples; i++) {
        const s = Math.max(-1, Math.min(1, sampleData[i]));
        const val = Math.floor(s * 32767);
        buffer.writeInt16LE(val, offset);
        offset += 2;
    }

    fs.writeFileSync(filePath, buffer);
}

const outDir = path.join(__dirname, '..', 'public', 'assets', 'audio');
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, 'bgm_lofi.wav');
writeWav(outPath, filtered, SAMPLE_RATE);

const fileSizeKB = Math.round(fs.statSync(outPath).size / 1024);
console.log(`Generated lofi BGM: ${outPath} (${fileSizeKB}KB, ${DURATION.toFixed(1)}s loop)`);
