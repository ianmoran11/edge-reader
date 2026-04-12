export interface Book {
  id: string;
  title: string;
  author: string;
  coverBlob: Blob | null;
  chapterCount: number;
  addedAt: number;
}

export interface Chapter {
  bookId: string;
  index: number;
  title: string;
  href: string;
  htmlContent: string;
  textContent: string;
}

export interface AudioTrack {
  bookId: string;
  chapterIndex: number;
  mp3Blob: Blob;
  duration: number;
}

export interface ReadingProgress {
  bookId: string;
  chapterIndex: number;
  scrollOffset: number;
  audioTimestamp: number;
}

export interface AppSettings {
  key: 'global';
  theme: 'light' | 'dark' | 'night';
  fontSize: number;
  fontFamily: 'serif' | 'sans-serif' | 'dyslexic';
  lineHeight: number;
  deepInfraApiKey: string | null;
  playbackSpeed: number;
}

export type Theme = 'light' | 'dark' | 'night';
export type FontFamily = 'serif' | 'sans-serif' | 'dyslexic';
export type PlaybackSpeed = 0.75 | 1 | 1.25 | 1.5 | 2;
