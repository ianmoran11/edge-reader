export type PlaybackSpeed = 0.75 | 1 | 1.25 | 1.5 | 2;

export interface TTSState {
  isPlaying: boolean;
  isPaused: boolean;
  currentChapter: number;
  speed: PlaybackSpeed;
  rate: number;
}

type TTSEventType = 'start' | 'end' | 'pause' | 'resume' | 'chapter';

interface TTSEventListener {
  (event: { type: TTSEventType; chapterIndex?: number }): void;
}

class EdgeTTSService {
  private synth: SpeechSynthesis;
  private utterances: SpeechSynthesisUtterance[] = [];
  private currentChapterIndex = 0;
  private currentChapterText = '';
  private isPlaying = false;
  private isPaused = false;
  private currentSpeed: PlaybackSpeed = 1;
  private listeners: TTSEventListener[] = [];

  constructor() {
    this.synth = window.speechSynthesis;
  }

  getSpeedRate(speed: PlaybackSpeed): number {
    return speed;
  }

  setSpeed(speed: PlaybackSpeed): void {
    this.currentSpeed = speed;
    if (this.isPlaying && !this.isPaused) {
      this.synth.cancel();
      this.speakChapter(
        this.currentChapterIndex,
        this.getChapterText(this.currentChapterIndex)
      );
    }
  }

  private getChapterText(index: number): string {
    return this.currentChapterText;
  }

  async speakChapter(chapterIndex: number, text: string): Promise<void> {
    this.synth.cancel();
    this.utterances = [];
    this.currentChapterIndex = chapterIndex;
    this.currentChapterText = text;
    this.isPlaying = true;
    this.isPaused = false;

    const sentences = this.splitIntoSentences(text);

    for (let i = 0; i < sentences.length; i++) {
      const utterance = new SpeechSynthesisUtterance(sentences[i]);
      utterance.rate = this.getSpeedRate(this.currentSpeed);
      utterance.pitch = 1;

      const voices = this.synth.getVoices();
      const preferredVoice =
        voices.find(
          (v) =>
            v.lang.startsWith('en') &&
            v.name.toLowerCase().includes('microsoft')
        ) ||
        voices.find((v) => v.lang.startsWith('en')) ||
        voices[0];

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      this.utterances.push(utterance);

      await new Promise<void>((resolve) => {
        utterance.onend = () => resolve();
        utterance.onerror = () => resolve();
        this.synth.speak(utterance);
      });
    }

    this.isPlaying = false;
    this.emit('end', chapterIndex);
  }

  private splitIntoSentences(text: string): string[] {
    return text
      .replace(/\s+/g, ' ')
      .split(/(?<=[.!?])\s+/)
      .filter((s) => s.length > 0);
  }

  pause(): void {
    if (this.isPlaying && !this.isPaused) {
      this.synth.pause();
      this.isPaused = true;
      this.emit('pause', this.currentChapterIndex);
    }
  }

  resume(): void {
    if (this.isPaused) {
      this.synth.resume();
      this.isPaused = false;
      this.emit('resume', this.currentChapterIndex);
    }
  }

  stop(): void {
    this.synth.cancel();
    this.isPlaying = false;
    this.isPaused = false;
    this.utterances = [];
    this.emit('end', this.currentChapterIndex);
  }

  onEvent(listener: TTSEventListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private emit(type: TTSEventType, chapterIndex?: number): void {
    this.listeners.forEach((l) => l({ type, chapterIndex }));
  }

  getState(): TTSState {
    return {
      isPlaying: this.isPlaying,
      isPaused: this.isPaused,
      currentChapter: this.currentChapterIndex,
      speed: this.currentSpeed,
      rate: this.getSpeedRate(this.currentSpeed),
    };
  }
}

export const ttsService = new EdgeTTSService();
