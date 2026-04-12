import { unzip } from 'fflate';
import { v4 as uuidv4 } from 'uuid';

export interface ParsedBook {
  id: string;
  title: string;
  author: string;
  coverBlob: Blob | null;
  chapters: Array<{
    title: string;
    href: string;
    htmlContent: string;
    textContent: string;
  }>;
  toc: Array<{ title: string; href: string; index: number }>;
}

function arrayBufferToBlob(buffer: ArrayBuffer, mimeType: string): Blob {
  return new Blob([buffer], { type: mimeType });
}

function getMimeType(href: string): string {
  const ext = href.split('.').pop()?.toLowerCase() ?? '';
  const mimeTypes: Record<string, string> = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    html: 'application/xhtml+xml',
    xhtml: 'application/xhtml+xml',
    xml: 'application/xml',
    ncx: 'application/x-dtbncx+xml',
    css: 'text/css',
    js: 'application/javascript',
    otf: 'font/otf',
    ttf: 'font/ttf',
    woff: 'font/woff',
    woff2: 'font/woff2',
  };
  return mimeTypes[ext] ?? 'application/octet-stream';
}

function extractTextFromHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.body.textContent ?? '';
}

function extractChapterTitle(html: string, fallbackIndex: number): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');

  // Try heading tags in order of preference
  for (const tag of ['h1', 'h2', 'h3']) {
    const heading = doc.querySelector(tag);
    if (heading?.textContent?.trim()) {
      return heading.textContent.trim();
    }
  }

  // Try first paragraph if no heading
  const firstP = doc.querySelector('p');
  if (firstP?.textContent?.trim()) {
    const text = firstP.textContent.trim();
    return text.length > 50 ? text.substring(0, 50) + '...' : text;
  }

  return `Chapter ${fallbackIndex + 1}`;
}

function findElementText(element: Element | null, tag: string): string {
  if (!element) return '';
  const el = element.querySelector(tag);
  return el?.textContent?.trim() ?? '';
}

function parseXml(xmlString: string): Document {
  const parser = new DOMParser();
  return parser.parseFromString(xmlString, 'application/xml');
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function buildImageMap(
  zipFiles: Record<string, Uint8Array>
): Map<string, string> {
  const imageMap = new Map<string, string>();
  const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'];

  for (const [path, data] of Object.entries(zipFiles)) {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    if (imageExtensions.includes(ext)) {
      const mimeType = getMimeType(path);
      const base64 = uint8ArrayToBase64(data);
      const dataUrl = `data:${mimeType};base64,${base64}`;
      // Store with multiple path variations for matching
      imageMap.set(path, dataUrl);
      // Also store just the filename
      const filename = path.split('/').pop() ?? path;
      imageMap.set(filename, dataUrl);
    }
  }

  return imageMap;
}

function replaceImageSrcs(
  html: string,
  imageMap: Map<string, string>,
  chapterDir: string
): string {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const images = doc.querySelectorAll('img');

  for (const img of images) {
    const src = img.getAttribute('src');
    if (!src || src.startsWith('data:')) continue;

    // Try different path resolutions
    const pathsToTry = [
      src,
      src.replace(/^\.\//, ''),
      chapterDir + src,
      chapterDir + src.replace(/^\.\//, ''),
      src.split('/').pop() ?? src,
    ];

    for (const path of pathsToTry) {
      const normalized = path.replace(/^\.\//, '').replace(/\/+/g, '/');
      if (imageMap.has(normalized)) {
        img.setAttribute('src', imageMap.get(normalized)!);
        break;
      }
      // Try matching just the filename
      const filename = normalized.split('/').pop() ?? normalized;
      if (imageMap.has(filename)) {
        img.setAttribute('src', imageMap.get(filename)!);
        break;
      }
    }
  }

  return doc.body.innerHTML;
}

export async function parseEpub(file: File): Promise<ParsedBook> {
  const arrayBuffer = await file.arrayBuffer();
  const zipFiles: Record<string, Uint8Array> = {};

  await new Promise<void>((resolve, reject) => {
    unzip(new Uint8Array(arrayBuffer), (err, data) => {
      if (err) reject(err);
      else {
        for (const [name, chunk] of Object.entries(data)) {
          zipFiles[name] = chunk;
        }
        resolve();
      }
    });
  });

  const rootfilePath = findRootFile(zipFiles);
  if (!rootfilePath) throw new Error('Could not find rootfile in EPUB');

  const rootfileContent = getFile(zipFiles, rootfilePath);
  if (!rootfileContent) throw new Error('Could not read rootfile');

  const rootfileDir = rootfilePath.includes('/')
    ? rootfilePath.substring(0, rootfilePath.lastIndexOf('/') + 1)
    : '';

  // Build image map for embedding images as data URLs
  const imageMap = buildImageMap(zipFiles);

  const opfDoc = parseXml(new TextDecoder().decode(rootfileContent));

  const metadata =
    opfDoc.querySelector('metadata') ?? opfDoc.querySelector('opf\\:metadata');
  const title =
    metadata?.querySelector('title')?.textContent?.trim() ??
    opfDoc.querySelector('dc\\:title')?.textContent?.trim() ??
    'Unknown Title';
  const author =
    metadata?.querySelector('creator')?.textContent?.trim() ??
    metadata?.querySelector('author')?.textContent?.trim() ??
    opfDoc.querySelector('dc\\:creator')?.textContent?.trim() ??
    'Unknown Author';

  const manifest = opfDoc.querySelector('manifest');
  const spine = opfDoc.querySelector('spine');

  const manifestItems: Map<
    string,
    { href: string; mediaType: string; properties?: string }
  > = new Map();
  const manifestList = manifest?.querySelectorAll('item') ?? [];
  for (const item of manifestList) {
    const id = item.getAttribute('id') ?? '';
    const href = item.getAttribute('href') ?? '';
    const mediaType = item.getAttribute('media-type') ?? '';
    const properties = item.getAttribute('properties') ?? undefined;
    manifestItems.set(id, { href, mediaType, properties });
  }

  const spineItems: Array<{ idref: string; linear: boolean }> = [];
  const spineList = spine?.querySelectorAll('itemref') ?? [];
  for (const item of spineList) {
    const idref = item.getAttribute('idref') ?? '';
    const linear = item.getAttribute('linear') !== 'no';
    spineItems.push({ idref, linear });
  }

  let coverBlob: Blob | null = null;
  const coverMeta = metadata?.querySelector('meta[name="cover"]');
  const coverId = coverMeta?.getAttribute('content');
  if (coverId) {
    const coverItem = manifestItems.get(coverId);
    if (coverItem) {
      const coverPath = rootfileDir + coverItem.href;
      const coverData = getFile(zipFiles, coverPath);
      if (coverData) {
        const coverHref = coverItem.href.toLowerCase();
        const mimeType = getMimeType(coverHref);
        coverBlob = arrayBufferToBlob(
          coverData.buffer as ArrayBuffer,
          mimeType
        );
      }
    }
  }

  if (!coverBlob) {
    for (const [id, item] of manifestItems) {
      if (item.properties?.includes('cover-image')) {
        const coverPath = rootfileDir + item.href;
        const coverData = getFile(zipFiles, coverPath);
        if (coverData) {
          coverBlob = arrayBufferToBlob(
            coverData.buffer as ArrayBuffer,
            getMimeType(item.href)
          );
          break;
        }
      }
    }
  }

  const chapters: Array<{
    title: string;
    href: string;
    htmlContent: string;
    textContent: string;
  }> = [];

  for (const spineItem of spineItems) {
    const manifestItem = manifestItems.get(spineItem.idref);
    if (!manifestItem) continue;

    const chapterPath = rootfileDir + manifestItem.href;
    const chapterData = getFile(zipFiles, chapterPath);

    if (chapterData) {
      const rawHtml = new TextDecoder().decode(chapterData);
      const textContent = extractTextFromHtml(rawHtml);
      const chapterTitle = extractChapterTitle(rawHtml, chapters.length);

      // Get the chapter's directory for resolving relative image paths
      const chapterDir = manifestItem.href.includes('/')
        ? rootfileDir + manifestItem.href.substring(0, manifestItem.href.lastIndexOf('/') + 1)
        : rootfileDir;

      // Replace image sources with embedded data URLs
      const htmlContent = replaceImageSrcs(rawHtml, imageMap, chapterDir);

      chapters.push({ title: chapterTitle, href: manifestItem.href, htmlContent, textContent });
    }
  }

  let toc: Array<{ title: string; href: string; index: number }> = [];
  const ncxItem = [...manifestItems.values()].find(
    (item) => item.mediaType === 'application/x-dtbncx+xml'
  );

  if (ncxItem) {
    const ncxPath = rootfileDir + ncxItem.href;
    const ncxData = getFile(zipFiles, ncxPath);
    if (ncxData) {
      const ncxDoc = parseXml(new TextDecoder().decode(ncxData));
      const navPoints = ncxDoc.querySelectorAll('navPoint');
      for (const point of navPoints) {
        const navLabel = point.querySelector('navLabel');
        const text = navLabel?.querySelector('text')?.textContent?.trim() ?? '';
        const content = point.querySelector('content');
        const src = content?.getAttribute('src') ?? '';
        if (text && src) {
          toc.push({ title: text, href: src, index: toc.length });
        }
      }
    }
  }

  if (toc.length === 0 && chapters.length > 0) {
    toc = chapters.map((ch, i) => ({
      title: ch.title,
      href: `#chapter-${i}`,
      index: i,
    }));
  }

  return {
    id: uuidv4(),
    title,
    author,
    coverBlob,
    chapters,
    toc,
  };
}

function findRootFile(zipFiles: Record<string, Uint8Array>): string | null {
  const containerPath = 'META-INF/container.xml';
  const containerData = zipFiles[containerPath];
  if (!containerData) return null;

  const doc = parseXml(new TextDecoder().decode(containerData));
  const rootfile = doc.querySelector('rootfile');
  return rootfile?.getAttribute('full-path') ?? null;
}

function getFile(
  zipFiles: Record<string, Uint8Array>,
  path: string
): Uint8Array | null {
  const normalizedPath = path.replace(/^\.\//, '').replace(/\//g, '/');
  for (const key of Object.keys(zipFiles)) {
    const normalizedKey = key.replace(/^\.\//, '').replace(/\//g, '/');
    if (
      normalizedKey === normalizedPath ||
      normalizedKey.endsWith('/' + normalizedPath)
    ) {
      return zipFiles[key];
    }
  }
  return null;
}
