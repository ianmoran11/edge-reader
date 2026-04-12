import { audioDB } from '../db';
import type { AudioTrack } from '../types';

export type PlaybackSpeed = 0.75 | 1 | 1.25 | 1.5 | 2;

interface AudioPlayerCallbacks {
  onPlay?: () => void;
  onPause?: () => void;
  onEnded?: () => void;
  onChapterEnd?: (chapterIndex: number) => void;
  onTimeUpdate?: (currentTime: number, duration: number) => void;
}

class AudioPlayerService {
  private audio: HTMLAudioElement | null = null;
  private currentBookId: string | null = null;
  private currentChapterIndex = 0;
  private speed: PlaybackSpeed = 1;
  private callbacks: AudioPlayerCallbacks = {};

  async loadChapter(bookId: string, chapterIndex: number): Promise<void> {
    const track = await audioDB.get(bookId, chapterIndex);
    if (!track) return;

    if (this.audio) {
      this.audio.pause();
      URL.revokeObjectURL(this.audio.src);
    }

    this.audio = new Audio();
    this.audio.src = URL.createObjectURL(track.mp3Blob);
    this.audio.playbackRate = this.speed;

    this.audio.addEventListener('play', () => this.callbacks.onPlay?.());
    this.audio.addEventListener('pause', () => this.callbacks.onPause?.());
    this.audio.addEventListener('ended', () => {
      this.callbacks.onChapterEnd?.(chapterIndex);
      this.callbacks.onEnded?.();
    });
    this.audio.addEventListener('timeupdate', () => {
      if (this.audio) {
        this.callbacks.onTimeUpdate?.(
          this.audio.currentTime,
          this.audio.duration
        );
      }
    });

    this.currentBookId = bookId;
    this.currentChapterIndex = chapterIndex;
  }

  play(): void {
    this.audio?.play();
  }

  pause(): void {
    this.audio?.pause();
  }

  stop(): void {
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
  }

  seek(time: number): void {
    if (this.audio) {
      this.audio.currentTime = time;
    }
  }

  setSpeed(speed: PlaybackSpeed): void {
    this.speed = speed;
    if (this.audio) {
      this.audio.playbackRate = speed;
    }
  }

  setCallbacks(callbacks: AudioPlayerCallbacks): void {
    this.callbacks = callbacks;
  }

  getCurrentTime(): number {
    return this.audio?.currentTime ?? 0;
  }

  getDuration(): number {
    return this.audio?.duration ?? 0;
  }

  isPlaying(): boolean {
    return this.audio ? !this.audio.paused : false;
  }
}

export const audioPlayer = new AudioPlayerService();
