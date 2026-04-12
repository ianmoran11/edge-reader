import { booksDB, chaptersDB, deleteBook } from '../db';
import { createStorageQuotaMonitor } from '../hooks/useStorageQuota';
import type { Book } from '../types';
import { parseEpub } from './epub';

const quotaMonitor = createStorageQuotaMonitor();
const QUOTA_WARNING_THRESHOLD = 80;

export interface ImportResult {
  success: boolean;
  bookId?: string;
  error?: string;
}

export async function importBook(
  file: File,
  onProgress?: (message: string) => void
): Promise<ImportResult> {
  try {
    await quotaMonitor.refresh();
    const currentQuota = quotaMonitor.current;
    const fileSize = file.size;
    const projectedUsage = currentQuota.usage + fileSize;
    const projectedPercent =
      currentQuota.quota > 0 ? (projectedUsage / currentQuota.quota) * 100 : 0;

    if (projectedPercent > QUOTA_WARNING_THRESHOLD) {
      onProgress?.(
        `Warning: This book would bring storage to ${Math.round(projectedPercent)}% (above ${QUOTA_WARNING_THRESHOLD}% threshold)`
      );
    }

    onProgress?.('Parsing EPUB...');
    const parsedBook = await parseEpub(file);

    onProgress?.('Saving to library...');
    const book: Book = {
      id: parsedBook.id,
      title: parsedBook.title,
      author: parsedBook.author,
      coverBlob: parsedBook.coverBlob,
      chapterCount: parsedBook.chapters.length,
      addedAt: Date.now(),
    };

    await booksDB.add(book);

    for (let i = 0; i < parsedBook.chapters.length; i++) {
      const ch = parsedBook.chapters[i];
      await chaptersDB.add({
        bookId: book.id,
        index: i,
        title: ch.title,
        href: ch.href,
        htmlContent: ch.htmlContent,
        textContent: ch.textContent,
      });
      onProgress?.(`Saved chapter ${i + 1} of ${parsedBook.chapters.length}`);
    }

    onProgress?.('Done!');
    return { success: true, bookId: book.id };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export { deleteBook, quotaMonitor, QUOTA_WARNING_THRESHOLD };
