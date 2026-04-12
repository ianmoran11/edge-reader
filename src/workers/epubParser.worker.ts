import { parseEpub } from '../services/epub';
import type { ParsedBook } from '../services/epub';

self.onmessage = async (event: MessageEvent<{ file: File }>) => {
  try {
    const { file } = event.data;
    const result: ParsedBook = await parseEpub(file);
    self.postMessage({ success: true, result });
  } catch (error) {
    self.postMessage({ success: false, error: (error as Error).message });
  }
};
