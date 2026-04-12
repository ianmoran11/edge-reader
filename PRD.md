# Product Requirements Document: Edge Reader

## 1. Executive Summary & Vision

Edge Reader is a mobile-optimized Progressive Web App (PWA) for managing, reading, and listening to ebooks. The product's core differentiator is a first-class Text-to-Speech experience that prioritizes Microsoft Edge's native browser TTS engine for zero-cost, low-latency audio playback, while providing a path to high-fidelity AI-generated audio via external APIs.

All user data—books, audio, reading progress, and settings—is stored entirely on the user's device. There is no server-side user state, no account required, and no privacy trade-off. The app is installable to the home screen and designed to function offline, making it a true personal reading companion.

**Vision:** A private, offline-capable ebook reader that makes listening as natural as reading, usable on a phone with the screen locked.

---

## 2. Target Audience & Use Cases

### Target Audience

- Commuters and travelers who consume books via audio while their phone is in their pocket
- Readers who want to switch fluidly between reading text and listening to audio for the same book
- Privacy-conscious users who do not want their library or reading habits stored on third-party servers
- Users with large ebook collections in EPUB format seeking a lightweight, self-contained reader

### User Stories

| #   | As a…    | I want to…                                               | So that…                                                           |
| --- | -------- | -------------------------------------------------------- | ------------------------------------------------------------------ |
| 1   | Reader   | Upload an EPUB file                                      | I can access my book in the app without a separate conversion step |
| 2   | Reader   | See my book's cover, title, and author in a library view | I can identify and open books quickly                              |
| 3   | Reader   | Navigate to a specific chapter via the Table of Contents | I can jump directly to relevant sections                           |
| 4   | Listener | Play TTS audio for any chapter using Edge's native voice | I can listen without generating or storing audio files             |
| 5   | Listener | Control playback from my phone's lock screen             | I can manage audio without unlocking my phone                      |
| 6   | Listener | Generate and download high-quality MP3 audio for a book  | I can listen with a more natural-sounding voice                    |
| 7   | Reader   | Resume exactly where I left off                          | I don't lose my place between sessions                             |
| 8   | Reader   | Adjust font size, family, and line height                | I can read comfortably on my phone screen                          |
| 9   | Reader   | Switch between Light, Dark, and Night color themes       | I can read in any lighting condition without eye strain            |
| 10  | User     | Export my entire library to a zip file                   | I can back up my books and progress before clearing browser data   |
| 11  | User     | Import a library backup                                  | I can restore my library on a new device or after a reset          |
| 12  | User     | See a warning before uploading a large book              | I don't accidentally fill my browser's storage quota               |

---

## 3. Functional Requirements

### 3.1 Library

| ID     | Requirement                                                                                                                                                  |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| LIB-01 | The app must accept EPUB file uploads via a file picker or drag-and-drop                                                                                     |
| LIB-02 | On upload, the app must parse the EPUB and extract: title, author, cover image, chapter list, and full text content                                          |
| LIB-03 | The library view must display each book as a card showing cover image, title, and author                                                                     |
| LIB-04 | The library must support deletion of individual books including all associated audio and metadata                                                            |
| LIB-05 | Before uploading, the app must estimate the file's storage impact and warn the user if it would bring total usage above 80% of the estimated available quota |

### 3.2 Reader

| ID     | Requirement                                                                                                |
| ------ | ---------------------------------------------------------------------------------------------------------- |
| RDR-01 | Books must be rendered chapter by chapter in a scrollable, mobile-optimized view                           |
| RDR-02 | A Table of Contents panel must allow direct navigation to any chapter                                      |
| RDR-03 | Reading progress (chapter index + scroll offset) must be saved automatically and continuously              |
| RDR-04 | On reopening a book, the app must restore the user's last position                                         |
| RDR-05 | Font size, font family (minimum 3 options), and line height must be user-configurable via a settings panel |
| RDR-06 | The app must support Light, Dark, and Night (low-contrast, red-tinted) color themes                        |

### 3.3 Data Management

| ID     | Requirement                                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------------------------- |
| DAT-01 | All data (book content, cover images, generated audio, settings, progress) must be persisted in IndexedDB         |
| DAT-02 | The app must expose a storage usage indicator showing current usage vs. estimated quota                           |
| DAT-03 | The app must support full library export as a ZIP file containing all book data, audio, and a JSON state manifest |
| DAT-04 | The app must support importing a previously exported ZIP to fully restore library state                           |
| DAT-05 | Import must validate the ZIP structure before writing to IndexedDB and surface clear errors on failure            |

### 3.4 TTS & Audio

| ID     | Requirement                                                                                                                                                          |
| ------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| TTS-01 | The app must use the Web Speech API (`SpeechSynthesis`) as the primary TTS engine, targeting Microsoft Edge voices                                                   |
| TTS-02 | Edge TTS playback must support variable speeds: 0.75x, 1x, 1.25x, 1.5x, 2x                                                                                           |
| TTS-03 | The app must include an audio generation feature that calls the DeepInfra API with the `kokoro-82m` model to produce MP3 audio for individual chapters or full books |
| TTS-04 | Generated MP3 files must be stored in IndexedDB and served locally for subsequent playback                                                                           |
| TTS-05 | The app must integrate the Media Session API to expose playback controls (play, pause, previous chapter, next chapter) on the OS lock screen and notification tray   |
| TTS-06 | Both Edge TTS and generated MP3 playback must respect the selected playback speed                                                                                    |
| TTS-07 | The app must display generation progress (e.g., chapter X of Y) when producing MP3 audio                                                                             |
| TTS-08 | The DeepInfra API key must be user-provided and stored locally; it must never be sent to the app's own backend                                                       |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| ID      | Requirement                                                                                                                |
| ------- | -------------------------------------------------------------------------------------------------------------------------- |
| PERF-01 | Initial app load (first contentful paint) must complete in under 3 seconds on a mid-range mobile device on a 4G connection |
| PERF-02 | Chapter rendering must complete in under 500ms for chapters up to 50,000 characters                                        |
| PERF-03 | Scroll and UI interactions must maintain 60fps on devices running iOS 15+ or Android 10+                                   |
| PERF-04 | Book upload and parsing must not block the main thread; all heavy parsing must run in a Web Worker                         |

### 4.2 Local Storage

| ID     | Requirement                                                                                                     |
| ------ | --------------------------------------------------------------------------------------------------------------- |
| STR-01 | The app must use the Storage Manager API (`navigator.storage.estimate()`) to determine available quota          |
| STR-02 | The app must request persistent storage (`navigator.storage.persist()`) on first use to reduce risk of eviction |
| STR-03 | The app must warn users when storage usage exceeds 80% of estimated quota                                       |
| STR-04 | Individual book text content is expected to be 1–5 MB; generated MP3 audio 50–200 MB per book                   |

### 4.3 PWA Criteria

| ID     | Requirement                                                                                             |
| ------ | ------------------------------------------------------------------------------------------------------- |
| PWA-01 | The app must have a valid Web App Manifest enabling "Add to Home Screen" on iOS and Android             |
| PWA-02 | The app must register a Service Worker that caches the app shell for offline use                        |
| PWA-03 | Core reading functionality (previously loaded books) must be available offline                          |
| PWA-04 | The app must be served over HTTPS (enforced by Vercel)                                                  |
| PWA-05 | The app must be responsive and usable on screens from 375px to 430px wide (iPhone SE to iPhone Pro Max) |

---

## 5. Technical Architecture & Stack

### 5.1 Hosting

- **Platform:** Vercel (static site / serverless functions)
- **Build:** The app is a client-side SPA; Vercel serves static assets with no persistent server-side state
- **Serverless functions (optional):** May be used as a thin proxy for DeepInfra API calls if CORS restrictions require it; no user data passes through them

### 5.2 Frontend Stack

| Concern      | Technology                                        |
| ------------ | ------------------------------------------------- |
| Framework    | React (or Svelte) — TBD at implementation         |
| Bundler      | Vite                                              |
| Language     | TypeScript                                        |
| Styling      | CSS Modules or Tailwind CSS                       |
| PWA tooling  | Vite PWA plugin (`vite-plugin-pwa`) with Workbox  |
| EPUB parsing | `epubjs` or custom ZIP+XML parser in a Web Worker |

### 5.3 IndexedDB Strategy

The app uses a structured IndexedDB schema with the following object stores:

| Store      | Key                      | Contents                                           |
| ---------- | ------------------------ | -------------------------------------------------- |
| `books`    | `bookId` (uuid)          | Metadata: title, author, cover blob, chapter index |
| `chapters` | `[bookId, chapterIndex]` | Parsed HTML/text content per chapter               |
| `audio`    | `[bookId, chapterIndex]` | MP3 blobs from DeepInfra generation                |
| `progress` | `bookId`                 | `{ chapterIndex, scrollOffset, audioTimestamp }`   |
| `settings` | `"global"`               | Theme, font preferences, API keys                  |

All large binary data (covers, audio) is stored as Blobs. IndexedDB access is wrapped in a thin async service layer; no raw IDB calls appear in UI components.

### 5.4 Media Session API Integration

The Media Session API is initialized when audio playback begins (either Edge TTS or MP3). Action handlers registered:

- `play` / `pause` — toggle current playback
- `previoustrack` — go to previous chapter
- `nexttrack` — go to next chapter
- `seekto` — seek within the current MP3 (not applicable to Edge TTS)

Metadata (book title, author, chapter name, cover art) is set on `navigator.mediaSession.metadata` at the start of each chapter.

### 5.5 DeepInfra API Integration

- **Endpoint:** DeepInfra TTS API, model `kokoro-82m`
- **Auth:** Bearer token provided by the user, stored in the `settings` IndexedDB store
- **Flow:**
  1. User selects a book/chapter and initiates generation
  2. App splits chapter text into segments ≤ 500 characters (API limit)
  3. Segments are sent sequentially with progress tracking
  4. Response MP3 blobs are concatenated and stored in the `audio` store
  5. On failure, partial progress is preserved and generation can be retried

---

## 6. UI/UX Specifications

### 6.1 Color Themes

| Theme | Background | Text      | Accent    | Use Case                          |
| ----- | ---------- | --------- | --------- | --------------------------------- |
| Light | `#FFFFFF`  | `#1A1A1A` | `#0066CC` | Daytime reading                   |
| Dark  | `#121212`  | `#E8E8E8` | `#4A9EFF` | Low-light environments            |
| Night | `#1A0000`  | `#FF6B6B` | `#FF4444` | Night reading, minimal blue light |

All themes must meet WCAG AA contrast ratios (4.5:1 for normal text).

### 6.2 Typography

User-configurable options:

| Setting     | Options                                                          | Default   |
| ----------- | ---------------------------------------------------------------- | --------- |
| Font size   | 14px – 24px (2px steps)                                          | 18px      |
| Font family | Serif (Georgia), Sans-serif (System UI), Dyslexic (OpenDyslexic) | System UI |
| Line height | 1.4, 1.6, 1.8, 2.0                                               | 1.6       |

### 6.3 Mobile Navigation

- **Library screen:** Full-screen grid of book cards. FAB (Floating Action Button) in bottom-right for adding a book.
- **Reader screen:** Bottom navigation bar with: Table of Contents, Audio Controls, Settings. No top navigation bar to maximize reading area.
- **Audio controls:** Persistent mini-player at the bottom of the reader screen showing current chapter, play/pause, speed selector, and a progress bar. Tapping expands to a full audio panel.
- **Table of Contents:** Slides up from the bottom as a sheet, listing all chapters. Current chapter is highlighted.
- **Gestures:** Swipe right to return to library from reader.

### 6.4 Offline & Install UX

- On first visit, display a banner prompting the user to install the app to their home screen
- When offline, display a subtle indicator; previously loaded books remain fully accessible
- Storage warning displays as a non-blocking banner with a link to the backup/export screen

---

## 7. Future Scope / Out of Scope for MVP

### Out of Scope (MVP)

- Cloud sync or multi-device library sharing
- User accounts or authentication
- Support for formats other than EPUB (PDF, MOBI, AZW3)
- Highlighting, annotations, or bookmarks
- Social features (sharing, recommendations)
- Custom TTS voices beyond Edge native voices
- Android/iOS native app wrappers (Capacitor, React Native)
- Search within book content
- Multiple DeepInfra models or alternative TTS API providers

### Future Scope (Post-MVP Candidates)

- Highlight and annotation system with export
- In-book search
- Sync via user-provided cloud storage (iCloud, Dropbox) using OAuth
- PDF support via PDF.js
- Additional TTS voices and models
- Reading statistics and streaks

---

## 8. Implementation Task List

### Phase 1: Project Foundation

- [x] 1. Initialize Vite + TypeScript project, configure Vercel deployment, set up ESLint/Prettier
- [x] 2. Install and configure `vite-plugin-pwa`; create Web App Manifest with correct icons and display mode
- [x] 3. Implement Service Worker with Workbox for app shell caching
- [x] 4. Design and implement IndexedDB schema (`books`, `chapters`, `audio`, `progress`, `settings` stores) with a typed async service layer
- [x] 5. Implement `navigator.storage.estimate()` and `navigator.storage.persist()` calls; expose a `useStorageQuota` hook

### Phase 2: Content Ingestion

- [x] 6. Implement EPUB file ingestion: accept file upload, unzip EPUB (using `fflate` or similar), parse OPF manifest
- [x] 7. Extract book metadata (title, author, cover image) from EPUB OPF/NCX; store in `books` IndexedDB store
- [x] 8. Parse and store chapter content (HTML text) chapter-by-chapter into `chapters` store; run in a Web Worker to avoid blocking the UI
- [x] 9. Parse Table of Contents from EPUB NCX or nav document; store chapter order and labels with the book record
- [x] 10. Implement storage quota warning: before writing, check if the write would exceed 80% of quota and show a warning banner

### Phase 3: Library UI

- [x] 11. Build Library screen with a responsive grid of book cards (cover, title, author)
- [x] 12. Implement FAB to trigger EPUB file picker and run the ingestion pipeline
- [x] 13. Implement book deletion (removes all associated chapters, audio, and progress from IndexedDB)
- [x] 14. Implement storage usage indicator on the Library or Settings screen

### Phase 4: Reader UI

- [x] 15. Build Reader screen: render chapter HTML content in a scrollable, mobile-optimized view
- [x] 16. Implement Table of Contents bottom sheet for chapter navigation
- [x] 17. Implement continuous progress saving (debounced scroll handler writes chapter index + scroll offset to `progress` store)
- [x] 18. Implement resume-on-open: when a book is opened, restore the last saved chapter and scroll position
- [x] 19. Build Settings panel (bottom sheet): theme selector, font size slider, font family picker, line height picker
- [x] 20. Implement Light, Dark, and Night CSS themes switchable at runtime via a CSS class on `<html>`

### Phase 5: Edge TTS Playback

- [x] 21. Implement Edge TTS service using `window.speechSynthesis`; expose play, pause, stop, and speed controls
- [x] 22. Implement chapter-level TTS: speak the text of the current chapter, advancing sentences with highlighting (optional)
- [x] 23. Implement playback speed selector (0.75x, 1x, 1.25x, 1.5x, 2x) applied to `SpeechSynthesisUtterance.rate`
- [x] 24. Integrate Media Session API: set metadata on chapter start, register play/pause/previoustrack/nexttrack action handlers

### Phase 6: DeepInfra Audio Generation

- [x] 25. Build Settings UI for entering and saving the DeepInfra API key (stored in `settings` IndexedDB store)
- [x] 26. Implement DeepInfra TTS generation service: split chapter text into ≤500-character segments, call API sequentially, concatenate MP3 blobs
- [x] 27. Implement generation progress UI: modal or bottom sheet showing "Generating chapter X of Y" with a cancel option
- [x] 28. Store completed MP3 blobs in `audio` IndexedDB store; mark chapters as having generated audio in the book record
- [x] 29. Implement MP3 playback using `<audio>` element; load from IndexedDB blob URL; apply playback speed via `audio.playbackRate`
- [x] 30. Wire MP3 playback into the Media Session API (including `seekto` handler and `setPositionState`)

### Phase 7: Backup & Restore

- [x] 31. Implement library export: serialize all IndexedDB stores to a JSON manifest + binary blobs, package as a ZIP file, trigger browser download
- [x] 32. Implement library import: accept ZIP file upload, validate manifest structure, write all data back to IndexedDB with a progress indicator

### Phase 8: Polish & Launch

- [x] 33. Implement "Add to Home Screen" install prompt banner (handle `beforeinstallprompt` event)
- [x] 34. Implement offline indicator (listen to `navigator.onLine` / `online`/`offline` events)
- [x] 35. Conduct end-to-end testing on iOS Safari and Android Chrome (primary target browsers)
- [x] 36. Audit Lighthouse scores: target PWA ✓, Performance ≥ 90, Accessibility ≥ 90
- [x] 37. Final UI pass: swipe-to-go-back gesture, scroll restoration, safe area insets for notched phones

---

## Notes

- **No backend state:** The Vercel deployment serves only static assets. All user data lives in the browser. This is a hard architectural constraint, not a cost-saving measure.
- **Edge TTS dependency:** `window.speechSynthesis` voice availability varies by OS and browser. The app should detect available voices on load and surface a warning if no high-quality voices are found, guiding the user to use Microsoft Edge.
- **EPUB compliance:** EPUB files from different sources vary in structure quality. The parser should be lenient and degrade gracefully (e.g., missing cover → placeholder image, missing ToC → chapter list derived from spine order).
- **DeepInfra API key security:** The API key is stored in IndexedDB (not `localStorage`) to reduce XSS exposure surface. It is sent directly from the browser to the DeepInfra API; the app's own Vercel deployment never sees it.

---

## 9. Bug Fixes & Improvements

### Phase 9: Critical Security & Functionality Fixes

#### Critical Issues

- [x] 38. **Fix XSS vulnerability in EPUB HTML rendering**
  - **Files:** `src/App.tsx:659`, `src/components/Reader.tsx:45`
  - **Problem:** EPUB HTML content is rendered via `dangerouslySetInnerHTML` without sanitization. Malicious EPUBs can execute arbitrary JavaScript via `<script>` tags or event handlers like `<img onerror="alert(1)">`.
  - **Fix:**
    1. Install DOMPurify: `npm install dompurify @types/dompurify`
    2. Create a sanitization utility in `src/utils/sanitize.ts`:
       ```typescript
       import DOMPurify from 'dompurify';
       export function sanitizeHtml(html: string): string {
         return DOMPurify.sanitize(html, {
           ALLOWED_TAGS: [
             'p',
             'br',
             'h1',
             'h2',
             'h3',
             'h4',
             'h5',
             'h6',
             'span',
             'div',
             'em',
             'strong',
             'i',
             'b',
             'u',
             'a',
             'img',
             'blockquote',
             'ul',
             'ol',
             'li',
             'table',
             'tr',
             'td',
             'th',
             'thead',
             'tbody',
           ],
           ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'class', 'id'],
           ALLOW_DATA_ATTR: false,
         });
       }
       ```
    3. Wrap all `dangerouslySetInnerHTML` content: `sanitizeHtml(chapter.htmlContent)`

- [x] 39. **Fix invalid MP3 concatenation**
  - **File:** `src/services/deepInfra.ts:112-123`
  - **Problem:** `combineAudioBlobs` concatenates raw MP3 bytes. MP3 files have frame headers and metadata; raw concatenation produces corrupted or partially-playable audio.
  - **Fix:** Replaced raw concatenation with Web Audio API approach: decode all MP3 chunks to AudioBuffers, concatenate them into a single buffer, then encode to WAV format using a custom `audioBufferToWav` function. Output format changed from `audio/mpeg` to `audio/wav`.

- [x] 40. **Fix backup import file type mismatch**
  - **Files:** `src/App.tsx:570-572`, `src/services/backup.ts`
  - **Problem:** Export creates a `.zip` file, but the import `<input>` only accepts `.json` files. Users cannot import their own backups.
  - **Fix:** Change the accept attribute in `src/App.tsx`:
    ```tsx
    <input
      type="file"
      accept=".zip" // Changed from ".json"
      className="hidden-input"
      id="backup-input"
      onChange={handleBackupFileSelect}
    />
    ```

#### Functional Bugs

- [x] 41. **Fix TTS speed change breaking playback**
  - **File:** `src/services/tts.ts:34-47`
  - **Problem:** `setSpeed()` calls `this.getChapterText()` which always returns empty string. TTS restarts with no text.
  - **Fix:** Store the current chapter text when `speakChapter` is called:

    ```typescript
    private currentChapterText = '';

    async speakChapter(chapterIndex: number, text: string): Promise<void> {
      this.currentChapterText = text;  // Add this line
      // ... rest of method
    }

    private getChapterText(index: number): string {
      return this.currentChapterText;  // Return stored text
    }
    ```

- [x] 42. **Fix cover images not persisting across reloads**
  - **Files:** `src/services/import.ts:56-58`, `src/types.ts`, `src/App.tsx`
  - **Problem:** Cover is stored as `URL.createObjectURL()` which is session-scoped. Covers disappear after page reload.
  - **Fix:**
    1. Change `Book.coverUrl` to `Book.coverBlob` in `src/types.ts`:
       ```typescript
       export interface Book {
         id: string;
         title: string;
         author: string;
         coverBlob: Blob | null; // Changed from coverUrl: string | null
         chapterCount: number;
         addedAt: number;
       }
       ```
    2. Update `src/services/import.ts` to store the blob directly:
       ```typescript
       const book: Book = {
         id: parsedBook.id,
         title: parsedBook.title,
         author: parsedBook.author,
         coverBlob: parsedBook.coverBlob, // Store blob, not URL
         chapterCount: parsedBook.chapters.length,
         addedAt: Date.now(),
       };
       ```
    3. In `src/App.tsx`, create Object URLs when rendering and revoke on cleanup:

       ```typescript
       const [coverUrls, setCoverUrls] = useState<Map<string, string>>(
         new Map()
       );

       useEffect(() => {
         const urls = new Map<string, string>();
         books.forEach((book) => {
           if (book.coverBlob) {
             urls.set(book.id, URL.createObjectURL(book.coverBlob));
           }
         });
         setCoverUrls(urls);
         return () => urls.forEach((url) => URL.revokeObjectURL(url));
       }, [books]);
       ```

- [x] 43. **Fix settings race condition on mount**
  - **File:** `src/App.tsx:116-129`
  - **Problem:** Settings are saved on mount before they're loaded from IndexedDB, potentially overwriting stored values with defaults.
  - **Fix:** Add a `settingsLoaded` flag:

    ```typescript
    const [settingsLoaded, setSettingsLoaded] = useState(false);

    useEffect(() => {
      initDB().then(async () => {
        // ... load books
        const settings = await settingsDB.get();
        if (settings) {
          setTheme(settings.theme);
          // ... set other state
        }
        setSettingsLoaded(true); // Mark as loaded AFTER setting state
      });
    }, []);

    useEffect(() => {
      if (!settingsLoaded) return; // Don't save until loaded
      const saveSettings = async () => {
        await settingsDB.save({
          /* ... */
        });
      };
      saveSettings();
    }, [
      settingsLoaded,
      theme,
      fontSize,
      fontFamily,
      lineHeight,
      apiKey,
      playbackSpeed,
    ]);
    ```

- [x] 44. **Fix Media Session stale closures**
  - **File:** `src/App.tsx:84-109`
  - **Problem:** Media Session handlers capture state values at mount time and never update. Lock screen controls use stale `isTTSPlaying`, `currentChapter`, and `chapters` values.
  - **Fix:** Move Media Session setup into a separate `useEffect` with proper dependencies:

    ```typescript
    useEffect(() => {
      if (!('mediaSession' in navigator)) return;

      navigator.mediaSession.setActionHandler('play', () => {
        if (isTTSPlaying) {
          ttsService.resume();
        } else {
          audioPlayerRef.current.play();
        }
      });
      navigator.mediaSession.setActionHandler('pause', () => {
        if (isTTSPlaying) {
          ttsService.pause();
        } else {
          audioPlayerRef.current.pause();
        }
      });
      navigator.mediaSession.setActionHandler('previoustrack', () => {
        if (currentChapter > 0) {
          handleChapterChange(currentChapter - 1);
        }
      });
      navigator.mediaSession.setActionHandler('nexttrack', () => {
        if (currentChapter < chapters.length - 1) {
          handleChapterChange(currentChapter + 1);
        }
      });
    }, [isTTSPlaying, currentChapter, chapters.length, handleChapterChange]);
    ```

- [x] 45. **Fix swipe gesture triggering accidentally**
  - **File:** `src/App.tsx:445-452`
  - **Problem:** Any touch starting within 50px of the left edge triggers back navigation, even vertical scrolling. Should detect horizontal swipe intent.
  - **Fix:** Track touch movement and only navigate on intentional rightward swipe:

    ```typescript
    useEffect(() => {
      let startX = 0;
      let startY = 0;

      const handleTouchStart = (e: TouchEvent) => {
        if (view === 'reader' && e.touches[0].clientX < 50) {
          startX = e.touches[0].clientX;
          startY = e.touches[0].clientY;
        }
      };

      const handleTouchEnd = (e: TouchEvent) => {
        if (view !== 'reader' || startX === 0) return;
        const endX = e.changedTouches[0].clientX;
        const endY = e.changedTouches[0].clientY;
        const deltaX = endX - startX;
        const deltaY = Math.abs(endY - startY);

        // Require: started near left edge, swiped right >80px, mostly horizontal
        if (startX < 50 && deltaX > 80 && deltaX > deltaY * 2) {
          handleBack();
        }
        startX = 0;
        startY = 0;
      };

      document.addEventListener('touchstart', handleTouchStart);
      document.addEventListener('touchend', handleTouchEnd);
      return () => {
        document.removeEventListener('touchstart', handleTouchStart);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }, [view, handleBack]);
    ```

#### Missing UI Styles

- [x] 46. **Add missing CSS for audio components**
  - **File:** `src/style.css`
  - **Problem:** Components `.mini-player`, `.audio-panel`, `.audio-section`, `.audio-controls`, `.speed-selector`, `.speed-buttons`, `.speed-btn`, `.play-btn`, `.stop-btn`, `.generate-btn`, `.generation-progress`, `.audio-hint` have no styles.
  - **Fix:** Add to `src/style.css`:

    ```css
    .audio-panel {
      padding: 16px;
    }

    .audio-section {
      margin-bottom: 24px;
    }

    .audio-section h3 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
    }

    .audio-controls {
      display: flex;
      gap: 12px;
      margin-bottom: 8px;
    }

    .play-btn,
    .stop-btn,
    .generate-btn {
      width: 48px;
      height: 48px;
      border-radius: 50%;
      border: 2px solid var(--border);
      background: var(--bg);
      font-size: 20px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .play-btn:active,
    .stop-btn:active,
    .generate-btn:active {
      background: var(--border);
    }

    .play-btn:disabled,
    .generate-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .audio-hint {
      font-size: 12px;
      opacity: 0.7;
    }

    .generation-progress {
      font-size: 12px;
      color: var(--accent);
      margin-top: 8px;
    }

    .speed-selector {
      display: flex;
      align-items: center;
      gap: 12px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
    }

    .speed-buttons {
      display: flex;
      gap: 8px;
      flex: 1;
    }

    .speed-btn {
      flex: 1;
      padding: 8px;
      border: 2px solid var(--border);
      border-radius: 8px;
      background: none;
      cursor: pointer;
      font-size: 14px;
    }

    .speed-btn.active {
      border-color: var(--accent);
      color: var(--accent);
    }

    .mini-player {
      position: fixed;
      bottom: 60px;
      left: 0;
      right: 0;
      background: var(--card-bg);
      border-top: 1px solid var(--border);
      padding: 8px 16px;
      padding-bottom: calc(8px + env(safe-area-inset-bottom));
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 100;
    }

    .mini-player-info {
      display: flex;
      align-items: center;
      gap: 8px;
      overflow: hidden;
    }

    .mini-player-status {
      font-size: 16px;
    }

    .mini-player-title {
      font-size: 14px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .mini-player-controls {
      display: flex;
      gap: 8px;
    }

    .mini-player-controls button {
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      padding: 4px 8px;
    }
    ```

#### Performance & Code Quality

- [x] 47. **Add index for chapters query**
  - **File:** `src/db/index.ts:123-137`
  - **Problem:** `chaptersDB.getAllForBook` fetches ALL chapters from IndexedDB then filters client-side. Inefficient for large libraries.
  - **Fix:** Create an index on `bookId` in the IndexedDB schema:

    ```typescript
    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result;

      if (!database.objectStoreNames.contains('chapters')) {
        const store = database.createObjectStore('chapters', {
          keyPath: ['bookId', 'index'],
        });
        store.createIndex('byBookId', 'bookId', { unique: false });
      }
      // ... rest of stores
    };
    ```

    Then use the index in the query:

    ```typescript
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
    }
    ```

    **Note:** This requires incrementing `DB_VERSION` and handling the upgrade.

- [x] 48. **Implement audio generation cancellation**
  - **File:** `src/services/deepInfra.ts`
  - **Problem:** `cancelled` variable exists but is never set; `cancelGeneration()` is a stub.
  - **Fix:** Use AbortController:

    ```typescript
    let abortController: AbortController | null = null;

    export async function generateChapterAudio(
      bookId: string,
      chapterIndex: number,
      text: string,
      apiKey: string,
      callbacks?: GenerationCallbacks
    ): Promise<void> {
      abortController = new AbortController();
      const { signal } = abortController;

      // ... in the fetch call:
      const response = await fetch(DEEPINFRA_API_URL, {
        method: 'POST',
        headers: {
          /* ... */
        },
        body: JSON.stringify({
          /* ... */
        }),
        signal, // Add abort signal
      });

      // ... rest of function
    }

    export function cancelGeneration(): void {
      if (abortController) {
        abortController.abort();
        abortController = null;
      }
    }
    ```
