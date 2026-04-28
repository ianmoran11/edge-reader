import { audioDB } from '../db';
import type { AudioTrack } from '../types';

const DEEPINFRA_API_URL = 'https://api.deepinfra.com/v1/inference/hexgrad/Kokoro-82M';

interface GenerationCallbacks {
  onProgress?: (chapter: number, total: number, message: string) => void;
  onComplete?: (chapterIndex: number) => void;
  onError?: (error: string) => void;
}

interface SegmentResult {
  audioData: ArrayBuffer;
}

const MAX_CHUNK_SIZE = 500;

let abortController: AbortController | null = null;

export async function generateChapterAudio(
  bookId: string,
  chapterIndex: number,
  text: string,
  apiKey: string,
  callbacks?: GenerationCallbacks
): Promise<void> {
  const segments = splitIntoSegments(text, MAX_CHUNK_SIZE);
  callbacks?.onProgress?.(
    chapterIndex,
    segments.length,
    `Starting generation...`
  );

  abortController = new AbortController();
  const { signal } = abortController;

  const audioChunks: ArrayBuffer[] = [];

  for (let i = 0; i < segments.length; i++) {
    callbacks?.onProgress?.(
      chapterIndex,
      segments.length,
      `Processing segment ${i + 1}/${segments.length}`
    );

    try {
      const response = await fetch(DEEPINFRA_API_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: segments[i],
          voice: 'af_bella',
        }),
        signal,
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      if (!data.audio) {
        throw new Error('No audio in response');
      }
      const base64 = (data.audio as string).includes(',')
        ? (data.audio as string).split(',')[1]
        : (data.audio as string);
      const binaryString = atob(base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      audioChunks.push(bytes.buffer);
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        callbacks?.onError?.('Generation cancelled');
        abortController = null;
        return;
      }
      callbacks?.onError?.(
        `Failed to generate segment ${i + 1}: ${(error as Error).message}`
      );
      throw error;
    }
  }

  abortController = null;

  const combinedAudio = await combineAudioBlobs(audioChunks);
  const mp3Blob = new Blob([combinedAudio], { type: 'audio/wav' });

  const track: AudioTrack = {
    bookId,
    chapterIndex,
    mp3Blob,
    duration: 0,
  };

  await audioDB.add(track);
  callbacks?.onComplete?.(chapterIndex);
}

function splitIntoSegments(text: string, maxLength: number): string[] {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const segments: string[] = [];
  let currentSegment = '';

  for (const sentence of sentences) {
    if ((currentSegment + sentence).length > maxLength) {
      if (currentSegment) {
        segments.push(currentSegment.trim());
      }
      currentSegment = sentence;
    } else {
      currentSegment += sentence;
    }
  }

  if (currentSegment.trim()) {
    segments.push(currentSegment.trim());
  }

  return segments;
}

async function combineAudioBlobs(chunks: ArrayBuffer[]): Promise<ArrayBuffer> {
  const audioContext = new AudioContext();

  const audioBuffers: AudioBuffer[] = [];
  for (const chunk of chunks) {
    const buffer = await audioContext.decodeAudioData(chunk.slice(0));
    audioBuffers.push(buffer);
  }

  const totalLength = audioBuffers.reduce((sum, buf) => sum + buf.length, 0);
  const resultBuffer = audioContext.createBuffer(
    audioBuffers[0].numberOfChannels,
    totalLength,
    audioBuffers[0].sampleRate
  );

  let offset = 0;
  for (const buffer of audioBuffers) {
    for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
      resultBuffer
        .getChannelData(channel)
        .set(buffer.getChannelData(channel), offset);
    }
    offset += buffer.length;
  }

  return audioBufferToWav(resultBuffer);
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1;
  const bitDepth = 16;

  const bytesPerSample = bitDepth / 8;
  const blockAlign = numChannels * bytesPerSample;
  const dataLength = buffer.length * blockAlign;
  const headerLength = 44;
  const totalLength = headerLength + dataLength;

  const arrayBuffer = new ArrayBuffer(totalLength);
  const view = new DataView(arrayBuffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, totalLength - 8, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, dataLength, true);

  const channels: Float32Array[] = [];
  for (let i = 0; i < numChannels; i++) {
    channels.push(buffer.getChannelData(i));
  }

  let offset = 44;
  for (let i = 0; i < buffer.length; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][i]));
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return arrayBuffer;
}

export function cancelGeneration(): void {
  if (abortController) {
    abortController.abort();
    abortController = null;
  }
}
