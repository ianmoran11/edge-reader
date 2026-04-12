import { zip, unzip } from 'fflate';
import { booksDB, chaptersDB, audioDB, progressDB, settingsDB } from '../db';
import type {
  Book,
  Chapter,
  AudioTrack,
  ReadingProgress,
  AppSettings,
} from '../types';

interface ExportManifest {
  version: number;
  exportedAt: number;
  books: Book[];
  chapters: Chapter[];
  audio: Array<{
    bookId: string;
    chapterIndex: number;
    filename: string;
    duration: number;
  }>;
  progress: ReadingProgress[];
  settings: AppSettings | null;
}

export async function exportLibrary(): Promise<Blob> {
  const books = await booksDB.getAll();
  const allChapters: Chapter[] = [];
  const allProgress: ReadingProgress[] = [];
  const audioFiles: Array<{
    bookId: string;
    chapterIndex: number;
    filename: string;
    data: Uint8Array;
    duration: number;
  }> = [];

  for (const book of books) {
    const chapters = await chaptersDB.getAllForBook(book.id);
    allChapters.push(...chapters);

    const progress = await progressDB.get(book.id);
    if (progress) {
      allProgress.push(progress);
    }

    const audioTracks = await audioDB.getAllForBook(book.id);
    for (const track of audioTracks) {
      const arrayBuffer = await track.mp3Blob.arrayBuffer();
      const filename = `audio/${track.bookId}/${track.chapterIndex}.mp3`;
      audioFiles.push({
        bookId: track.bookId,
        chapterIndex: track.chapterIndex,
        filename,
        data: new Uint8Array(arrayBuffer),
        duration: track.duration,
      });
    }
  }

  const settings = await settingsDB.get();

  const manifest: ExportManifest = {
    version: 1,
    exportedAt: Date.now(),
    books,
    chapters: allChapters,
    audio: audioFiles.map((f) => ({
      bookId: f.bookId,
      chapterIndex: f.chapterIndex,
      filename: f.filename,
      duration: f.duration,
    })),
    progress: allProgress,
    settings: settings ?? null,
  };

  const files: Record<string, Uint8Array> = {
    'manifest.json': new TextEncoder().encode(
      JSON.stringify(manifest, null, 2)
    ),
  };

  for (const audio of audioFiles) {
    files[audio.filename] = audio.data;
  }

  return new Promise((resolve, reject) => {
    zip(files, (err, data) => {
      if (err) reject(err);
      else
        resolve(new Blob([new Uint8Array(data)], { type: 'application/zip' }));
    });
  });
}

export async function importLibrary(
  file: File,
  onProgress?: (message: string) => void
): Promise<void> {
  onProgress?.('Reading file...');

  const arrayBuffer = await file.arrayBuffer();
  const zipFiles: Record<string, Uint8Array> = await new Promise(
    (resolve, reject) => {
      unzip(new Uint8Array(arrayBuffer), (err, data) => {
        if (err) reject(err);
        else resolve(data as Record<string, Uint8Array>);
      });
    }
  );

  const manifestFile = zipFiles['manifest.json'];
  if (!manifestFile) {
    throw new Error('Invalid backup file: missing manifest.json');
  }

  const manifestText = new TextDecoder().decode(manifestFile);
  const manifest: ExportManifest = JSON.parse(manifestText);

  if (!manifest.version || !manifest.books) {
    throw new Error('Invalid backup file format');
  }

  const audioMap = new Map<string, Uint8Array>();
  for (const [path, data] of Object.entries(zipFiles)) {
    if (path.startsWith('audio/')) {
      audioMap.set(path, data);
    }
  }

  onProgress?.('Importing books...');
  for (const book of manifest.books) {
    await booksDB.add(book);
  }

  onProgress?.('Importing chapters...');
  for (const chapter of manifest.chapters) {
    await chaptersDB.add(chapter);
  }

  onProgress?.('Importing audio...');
  for (const audio of manifest.audio) {
    const audioData = audioMap.get(audio.filename);
    if (audioData) {
      const mp3Blob = new Blob([new Uint8Array(audioData)], {
        type: 'audio/mpeg',
      });
      await audioDB.add({
        bookId: audio.bookId,
        chapterIndex: audio.chapterIndex,
        mp3Blob,
        duration: audio.duration,
      });
    }
  }

  onProgress?.('Importing progress...');
  for (const progress of manifest.progress) {
    await progressDB.save(progress);
  }

  if (manifest.settings) {
    onProgress?.('Importing settings...');
    await settingsDB.save(manifest.settings);
  }

  onProgress?.('Done!');
}

export async function downloadBackup(): Promise<void> {
  const blob = await exportLibrary();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `edge-reader-backup-${new Date().toISOString().split('T')[0]}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
