import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// These are deterministic sine-wave test fixtures, not recordings of instruments.
const output = fileURLToPath(new URL("../public/samples/test-tones/", import.meta.url));
const sampleRate = 44100;
const seconds = 0.8;
const frames = Math.round(sampleRate * seconds);

function wavTone(frequency) {
  const pcmBytes = frames * 2;
  const bytes = Buffer.alloc(44 + pcmBytes);
  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(36 + pcmBytes, 4);
  bytes.write("WAVEfmt ", 8);
  bytes.writeUInt32LE(16, 16);
  bytes.writeUInt16LE(1, 20);
  bytes.writeUInt16LE(1, 22);
  bytes.writeUInt32LE(sampleRate, 24);
  bytes.writeUInt32LE(sampleRate * 2, 28);
  bytes.writeUInt16LE(2, 32);
  bytes.writeUInt16LE(16, 34);
  bytes.write("data", 36);
  bytes.writeUInt32LE(pcmBytes, 40);
  for (let frame = 0; frame < frames; frame += 1) {
    const fadeIn = Math.min(1, frame / (sampleRate * 0.01));
    const fadeOut = Math.min(1, (frames - 1 - frame) / (sampleRate * 0.02));
    const envelope = Math.min(fadeIn, fadeOut);
    const amplitude = 0.4 * envelope * Math.sin(2 * Math.PI * frequency * frame / sampleRate);
    bytes.writeInt16LE(Math.round(amplitude * 32767), 44 + frame * 2);
  }
  return bytes;
}

mkdirSync(output, { recursive: true });
for (const [name, frequency] of [["c4.wav", 261.625565], ["g4.wav", 391.995436]]) {
  writeFileSync(join(output, name), wavTone(frequency));
}
console.log(`Generated two self-authored test tones in ${dirname(join(output, "c4.wav"))}`);
