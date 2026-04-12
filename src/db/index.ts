import type {
  Book,
  Chapter,
  AudioTrack,
  ReadingProgress,
  AppSettings,
} from '../types';

const DB_NAME = 'edge-reader';
const DB_VERSION = 2;

let db: IDBDatabase | null = null;

export async function initDB(): Promise<IDBDatabase> {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains('books')) {
        database.createObjectStore('books', { keyPath: 'id' });
      }

      if (!database.objectStoreNames.contains('chapters')) {
        const store = database.createObjectStore('chapters', {
          keyPath: ['bookId', 'index'],
        });
        store.createIndex('byBookId', 'bookId', { unique: false });
      }

      if (!database.objectStoreNames.contains('audio')) {
        database.createObjectStore('audio', {
          keyPath: ['bookId', 'chapterIndex'],
        });
      }

      if (!database.objectStoreNames.contains('progress')) {
        database.createObjectStore('progress', { keyPath: 'bookId' });
      }

      if (!database.objectStoreNames.contains('settings')) {
        database.createObjectStore('settings', { keyPath: 'key' });
      }
    };

    request.onsuccess = (event) => {
      db = (event.target as IDBOpenDBRequest).result;
      resolve(db);
    };

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
}

function promisifyRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const booksDB = {
  async add(book: Book): Promise<void> {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('books', 'readwrite');
      tx.objectStore('books').add(book);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async get(id: string): Promise<Book | undefined> {
    const database = await initDB();
    return promisifyRequest(
      database.transaction('books').objectStore('books').get(id)
    );
  },

  async getAll(): Promise<Book[]> {
    const database = await initDB();
    return promisifyRequest(
      database.transaction('books').objectStore('books').getAll()
    );
  },

  async delete(id: string): Promise<void> {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('books', 'readwrite');
      tx.objectStore('books').delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

export const chaptersDB = {
  async add(chapter: Chapter): Promise<void> {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('chapters', 'readwrite');
      tx.objectStore('chapters').add(chapter);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async get(bookId: string, index: number): Promise<Chapter | undefined> {
    const database = await initDB();
    return promisifyRequest(
      database
        .transaction('chapters')
        .objectStore('chapters')
        .get([bookId, index])
    );
  },

  async getAllForBook(bookId: string): Promise<Chapter[]> {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('chapters', 'readonly');
      const store = tx.objectStore('chapters');
      const index = store.index('byBookId');
      const request = index.getAll(bookId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  async deleteForBook(bookId: string): Promise<void> {
    const database = await initDB();
    const chapters = await chaptersDB.getAllForBook(bookId);
    return new Promise((resolve, reject) => {
      const tx = database.transaction('chapters', 'readwrite');
      chapters.forEach((ch) =>
        tx.objectStore('chapters').delete([ch.bookId, ch.index])
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

export const audioDB = {
  async add(audio: AudioTrack): Promise<void> {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('audio', 'readwrite');
      tx.objectStore('audio').add(audio);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async get(
    bookId: string,
    chapterIndex: number
  ): Promise<AudioTrack | undefined> {
    const database = await initDB();
    return promisifyRequest(
      database
        .transaction('audio')
        .objectStore('audio')
        .get([bookId, chapterIndex])
    );
  },

  async getAllForBook(bookId: string): Promise<AudioTrack[]> {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('audio', 'readonly');
      const store = tx.objectStore('audio');
      const request = store.getAll();
      request.onsuccess = () => {
        const results = request.result.filter(
          (a: AudioTrack) => a.bookId === bookId
        );
        resolve(results);
      };
      request.onerror = () => reject(request.error);
    });
  },

  async deleteForBook(bookId: string): Promise<void> {
    const database = await initDB();
    const tracks = await audioDB.getAllForBook(bookId);
    return new Promise((resolve, reject) => {
      const tx = database.transaction('audio', 'readwrite');
      tracks.forEach((t) =>
        tx.objectStore('audio').delete([t.bookId, t.chapterIndex])
      );
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

export const progressDB = {
  async save(progress: ReadingProgress): Promise<void> {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('progress', 'readwrite');
      tx.objectStore('progress').put(progress);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async get(bookId: string): Promise<ReadingProgress | undefined> {
    const database = await initDB();
    return promisifyRequest(
      database.transaction('progress').objectStore('progress').get(bookId)
    );
  },

  async delete(bookId: string): Promise<void> {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('progress', 'readwrite');
      tx.objectStore('progress').delete(bookId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },
};

export const settingsDB = {
  async save(settings: AppSettings): Promise<void> {
    const database = await initDB();
    return new Promise((resolve, reject) => {
      const tx = database.transaction('settings', 'readwrite');
      tx.objectStore('settings').put(settings);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async get(): Promise<AppSettings | undefined> {
    const database = await initDB();
    return promisifyRequest(
      database.transaction('settings').objectStore('settings').get('global')
    );
  },
};

export async function deleteBook(bookId: string): Promise<void> {
  await chaptersDB.deleteForBook(bookId);
  await audioDB.deleteForBook(bookId);
  await progressDB.delete(bookId);
  await booksDB.delete(bookId);
}
