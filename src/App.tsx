import { useState, useEffect, useCallback, useRef } from 'react';
import { sanitizeHtml } from './utils/sanitize';
import { TocSheet, SettingsPanel } from './components/Reader';
import {
  booksDB,
  chaptersDB,
  audioDB,
  progressDB,
  settingsDB,
  deleteBook,
} from './db';
import { initDB } from './db';
import { importBook } from './services/import';
import { downloadBackup, importLibrary } from './services/backup';
import { generateChapterAudio } from './services/deepInfra';
import { createStorageQuotaMonitor } from './hooks/useStorageQuota';
import { ttsService } from './services/tts';
import { audioPlayer } from './services/audioPlayer';
import type { Book, Chapter } from './types';
import './style.css';

type View = 'library' | 'reader';
type Theme = 'light' | 'dark' | 'night';
type FontFamily = 'serif' | 'sans-serif' | 'dyslexic';
type PlaybackSpeed = 0.75 | 1 | 1.25 | 1.5 | 2;

const QUOTA_WARNING_THRESHOLD = 80;
const SPEEDS: PlaybackSpeed[] = [0.75, 1, 1.25, 1.5, 2];

export function App() {
  const [view, setView] = useState<View>('library');
  const [books, setBooks] = useState<Book[]>([]);
  const [currentBookId, setCurrentBookId] = useState<string | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState(0);
  const [scrollOffset, setScrollOffset] = useState(0);
  const [showToc, setShowToc] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAudioPanel, setShowAudioPanel] = useState(false);
  const [theme, setTheme] = useState<Theme>('light');
  const [fontSize, setFontSize] = useState(18);
  const [fontFamily, setFontFamily] = useState<FontFamily>('sans-serif');
  const [lineHeight, setLineHeight] = useState(1.6);
  const [importProgress, setImportProgress] = useState<string | null>(null);
  const [showImportProgress, setShowImportProgress] = useState(false);
  const [quotaWarning, setQuotaWarning] = useState<string | null>(null);
  const [isTTSPlaying, setIsTTSPlaying] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [currentAudioTime, setCurrentAudioTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [apiKey, setApiKey] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [generatedAudioChapters, setGeneratedAudioChapters] = useState<
    Set<string>
  >(new Set());
  const [coverUrls, setCoverUrls] = useState<Map<string, string>>(new Map());
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<string | null>(
    null
  );
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  const saveTimeoutRef = useRef<number | null>(null);
  const audioPlayerRef = useRef(audioPlayer);

  const quotaMonitor = createStorageQuotaMonitor();

  useEffect(() => {
    initDB().then(async () => {
      const allBooks = await booksDB.getAll();
      setBooks(allBooks);
      const settings = await settingsDB.get();
      if (settings) {
        setTheme(settings.theme);
        setFontSize(settings.fontSize);
        setFontFamily(settings.fontFamily);
        setLineHeight(settings.lineHeight);
        setPlaybackSpeed((settings.playbackSpeed || 1) as PlaybackSpeed);
        setApiKey(settings.deepInfraApiKey || '');
      }
      setSettingsLoaded(true);
      await quotaMonitor.requestPersist();
      quotaMonitor.refresh();
    });
  }, []);

  useEffect(() => {
    const urls = new Map<string, string>();
    books.forEach((book) => {
      if (book.coverBlob) {
        urls.set(book.id, URL.createObjectURL(book.coverBlob));
      }
    });
    setCoverUrls(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [books]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    if (!settingsLoaded) return;
    const saveSettings = async () => {
      await settingsDB.save({
        key: 'global',
        theme,
        fontSize,
        fontFamily,
        lineHeight,
        deepInfraApiKey: apiKey || null,
        playbackSpeed,
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

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  useEffect(() => {
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallPrompt(true);
    };
    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    return () =>
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
  }, []);

  const handleInstall = useCallback(async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setShowInstallPrompt(false);
        setDeferredPrompt(null);
      }
    }
  }, [deferredPrompt]);

  useEffect(() => {
    if (currentBookId) {
      loadBook(currentBookId);
    }
  }, [currentBookId]);

  const loadBook = async (bookId: string) => {
    const bookChapters = await chaptersDB.getAllForBook(bookId);
    setChapters(bookChapters.sort((a, b) => a.index - b.index));
    const progress = await progressDB.get(bookId);
    if (progress) {
      setCurrentChapter(progress.chapterIndex);
      setScrollOffset(progress.scrollOffset);
      requestAnimationFrame(() => {
        if (contentRef.current) {
          contentRef.current.scrollTop = progress.scrollOffset;
        }
      });
    }
    const audioBookId = bookId;
    const generated = new Set<string>();
    for (const ch of bookChapters) {
      const track = await audioDB.get(audioBookId, ch.index);
      if (track) {
        generated.add(`${bookId}:${ch.index}`);
      }
    }
    setGeneratedAudioChapters(generated);
  };

  const handleAddBook = useCallback(() => {
    const input = document.getElementById('epub-input') as HTMLInputElement;
    input?.click();
  }, []);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setShowImportProgress(true);
      setImportProgress('Starting import...');

      try {
        await quotaMonitor.refresh();
        const currentQuota = quotaMonitor.current;
        const projectedUsage = currentQuota.usage + file.size;
        const projectedPercent =
          currentQuota.quota > 0
            ? (projectedUsage / currentQuota.quota) * 100
            : 0;

        if (projectedPercent > QUOTA_WARNING_THRESHOLD) {
          setQuotaWarning(
            `This book would bring storage to ${Math.round(projectedPercent)}% (above ${QUOTA_WARNING_THRESHOLD}% threshold)`
          );
        }

        const result = await importBook(file, (msg) => setImportProgress(msg));

        if (result.success && result.bookId) {
          const allBooks = await booksDB.getAll();
          setBooks(allBooks);
          setCurrentBookId(result.bookId);
          setView('reader');
          setShowImportProgress(false);
          setImportProgress(null);
        } else {
          console.error('Import failed:', result.error);
          setImportProgress(`Error: ${result.error || 'Unknown error'}`);
          setTimeout(() => {
            setShowImportProgress(false);
            setImportProgress(null);
          }, 5000);
          return;
        }
      } catch (err) {
        console.error('Import exception:', err);
        setImportProgress(`Error: ${(err as Error).message}`);
        setTimeout(() => {
          setShowImportProgress(false);
          setImportProgress(null);
        }, 5000);
        return;
      }
      const inputEl = document.getElementById(
        'epub-input'
      ) as HTMLInputElement | null;
      if (inputEl) inputEl.value = '';
    },
    []
  );

  const handleBackupFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      setShowImportProgress(true);
      setImportProgress('Restoring backup...');

      try {
        await importLibrary(file, (msg) => setImportProgress(msg));
        const allBooks = await booksDB.getAll();
        setBooks(allBooks);
      } catch (error) {
        setImportProgress(`Error: ${(error as Error).message}`);
        setTimeout(() => {
          setShowImportProgress(false);
          setImportProgress(null);
        }, 3000);
        return;
      }

      setShowImportProgress(false);
      setImportProgress(null);
      const inputEl = document.getElementById(
        'backup-input'
      ) as HTMLInputElement | null;
      if (inputEl) inputEl.value = '';
    },
    []
  );

  const handleDeleteBook = useCallback(async (bookId: string) => {
    await deleteBook(bookId);
    const allBooks = await booksDB.getAll();
    setBooks(allBooks);
  }, []);

  const handleScroll = useCallback(
    (offset: number) => {
      setScrollOffset(offset);
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
      saveTimeoutRef.current = window.setTimeout(async () => {
        if (currentBookId) {
          await progressDB.save({
            bookId: currentBookId,
            chapterIndex: currentChapter,
            scrollOffset: offset,
            audioTimestamp: 0,
          });
        }
      }, 500);
    },
    [currentBookId, currentChapter]
  );

  const handleChapterChange = useCallback(
    async (index: number, scrollToId?: string) => {
      setCurrentChapter(index);
      if (currentBookId) {
        await progressDB.save({
          bookId: currentBookId,
          chapterIndex: index,
          scrollOffset: 0,
          audioTimestamp: 0,
        });
        updateMediaSessionMetadata(index);
      }
      if (contentRef.current) {
        contentRef.current.scrollTop = 0;
      }
      if (scrollToId) {
        requestAnimationFrame(() => {
          const el = document.getElementById(scrollToId);
          el?.scrollIntoView({ behavior: 'smooth' });
        });
      }
    },
    [currentBookId, chapters]
  );

  const handleContentClick = useCallback(
    (e: React.MouseEvent) => {
      const target = e.target as HTMLElement;
      const anchor = target.closest('a');
      if (!anchor) return;

      const href = anchor.getAttribute('href');
      if (!href) return;

      e.preventDefault();

      // Same-page anchor link
      if (href.startsWith('#')) {
        const id = href.slice(1);
        const el = document.getElementById(id);
        el?.scrollIntoView({ behavior: 'smooth' });
        return;
      }

      // Cross-chapter link (e.g., "chapter2.xhtml" or "chapter2.xhtml#section")
      const [filePart, hashPart] = href.split('#');
      const targetFile = filePart.split('/').pop(); // Get just the filename

      const chapterIndex = chapters.findIndex((ch) => {
        const chapterFile = ch.href.split('/').pop();
        return chapterFile === targetFile;
      });

      if (chapterIndex !== -1) {
        handleChapterChange(chapterIndex, hashPart);
      }
    },
    [chapters, handleChapterChange]
  );

  const updateMediaSessionMetadata = (chapterIndex: number) => {
    if ('mediaSession' in navigator && currentBookId) {
      const currentBook = books.find((b) => b.id === currentBookId);
      const chapter = chapters[chapterIndex];
      if (currentBook && chapter) {
        navigator.mediaSession.metadata = new MediaMetadata({
          title: chapter.title,
          artist: currentBook.author,
          album: currentBook.title,
        });
      }
    }
  };

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

  const handlePlayTTS = useCallback(() => {
    if (!currentBookId || chapters.length === 0) return;

    if (isTTSPlaying) {
      ttsService.pause();
      setIsTTSPlaying(false);
    } else {
      const chapter = chapters[currentChapter];
      if (chapter) {
        setIsTTSPlaying(true);
        updateMediaSessionMetadata(currentChapter);
        ttsService.onEvent((event) => {
          if (event.type === 'end' && event.chapterIndex !== undefined) {
            if (event.chapterIndex < chapters.length - 1) {
              handleChapterChange(event.chapterIndex + 1);
            } else {
              setIsTTSPlaying(false);
            }
          }
        });
        ttsService.setSpeed(playbackSpeed);
        ttsService.speakChapter(currentChapter, chapter.textContent);
      }
    }
  }, [currentBookId, chapters, currentChapter, isTTSPlaying, playbackSpeed]);

  const handleStopTTS = useCallback(() => {
    ttsService.stop();
    setIsTTSPlaying(false);
  }, []);

  const handleSpeedChange = useCallback((speed: PlaybackSpeed) => {
    setPlaybackSpeed(speed);
    ttsService.setSpeed(speed);
    audioPlayerRef.current.setSpeed(speed);
  }, []);

  const handleGenerateAudio = useCallback(async () => {
    if (!apiKey) {
      setGenerationProgress('Please enter your DeepInfra API key in Settings');
      return;
    }
    if (!currentBookId) return;

    setIsGenerating(true);
    setGenerationProgress(
      `Generating audio for chapter ${currentChapter + 1}/${chapters.length}...`
    );

    const chapter = chapters[currentChapter];
    if (!chapter) return;

    let errorOccurred = false;
    try {
      await generateChapterAudio(
        currentBookId,
        currentChapter,
        chapter.textContent,
        apiKey,
        {
          onProgress: (ch, total, msg) => {
            setGenerationProgress(
              msg || `Generating chapter ${ch + 1} of ${total}...`
            );
          },
          onComplete: (chIdx) => {
            setGeneratedAudioChapters((prev) =>
              new Set(prev).add(`${currentBookId}:${chIdx}`)
            );
          },
          onError: (err) => {
            errorOccurred = true;
            setGenerationProgress(`Error: ${err}`);
          },
        }
      );
    } catch (err) {
      if (!errorOccurred) {
        setGenerationProgress(`Error: ${(err as Error).message}`);
      }
      errorOccurred = true;
    }

    setIsGenerating(false);
    if (!errorOccurred) {
      setGenerationProgress(null);
    }
  }, [currentBookId, currentChapter, chapters, apiKey]);

  const handlePlayGeneratedAudio = useCallback(() => {
    if (!currentBookId) return;

    audioPlayerRef.current.setCallbacks({
      onEnded: () => {
        if (currentChapter < chapters.length - 1) {
          handleChapterChange(currentChapter + 1);
          audioPlayerRef.current
            .loadChapter(currentBookId, currentChapter + 1)
            .then(() => {
              audioPlayerRef.current.play();
            });
        }
      },
    });
    audioPlayerRef.current
      .loadChapter(currentBookId, currentChapter)
      .then(() => {
        audioPlayerRef.current.play();
      });
  }, [currentBookId, currentChapter, chapters, handleChapterChange]);

  const handleBack = useCallback(() => {
    setView('library');
    setCurrentBookId(null);
    setChapters([]);
    setCurrentChapter(0);
    setScrollOffset(0);
    ttsService.stop();
    setIsTTSPlaying(false);
  }, []);

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

  if (view === 'library') {
    return (
      <div className="library-view">
        <header className="library-header">
          <h1>Edge Reader</h1>
          <div className="header-actions">
            <button
              className="icon-btn"
              onClick={() => {
                const input = document.getElementById(
                  'backup-input'
                ) as HTMLInputElement;
                input?.click();
              }}
              title="Restore backup"
            >
              📥
            </button>
            <button
              className="icon-btn"
              onClick={async () => {
                await downloadBackup();
              }}
              title="Export backup"
            >
              📤
            </button>
            <div
              className="storage-indicator"
              title={`Storage: ${Math.round(quotaMonitor.current.percentUsed)}%`}
            >
              📚 {Math.round(quotaMonitor.current.percentUsed)}%
            </div>
          </div>
        </header>

        {!isOnline && (
          <div className="offline-banner">
            📡 Offline - Previously loaded books are still available
          </div>
        )}

        {showInstallPrompt && (
          <div className="install-banner">
            <span>Install Edge Reader for the best experience</span>
            <div className="install-actions">
              <button onClick={handleInstall}>Install</button>
              <button onClick={() => setShowInstallPrompt(false)}>×</button>
            </div>
          </div>
        )}

        {quotaWarning && (
          <div className="quota-warning">
            ⚠️ {quotaWarning}
            <button onClick={() => setQuotaWarning(null)}>×</button>
          </div>
        )}

        {books.length === 0 ? (
          <div className="empty-state">
            <p>No books yet</p>
            <p className="empty-hint">Tap + to add your first book</p>
          </div>
        ) : (
          <div className="book-grid">
            {books.map((book) => (
              <div
                key={book.id}
                className="book-card"
                onClick={() => {
                  setCurrentBookId(book.id);
                  setView('reader');
                }}
              >
                {coverUrls.get(book.id) ? (
                  <img
                    src={coverUrls.get(book.id)!}
                    alt={book.title}
                    className="book-cover"
                  />
                ) : (
                  <div className="book-cover-placeholder">📖</div>
                )}
                <div className="book-info">
                  <h3 className="book-title">{book.title}</h3>
                  <p className="book-author">{book.author}</p>
                </div>
                <button
                  className="delete-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteBook(book.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <button className="fab" onClick={handleAddBook} aria-label="Add book">
          +
        </button>
        <input
          type="file"
          accept=".epub"
          className="hidden-input"
          id="epub-input"
          onChange={handleFileSelect}
        />
        <input
          type="file"
          accept=".zip"
          className="hidden-input"
          id="backup-input"
          onChange={handleBackupFileSelect}
        />

        {showImportProgress && importProgress && (
          <div className="import-overlay">
            <div className="import-modal">
              <p>{importProgress}</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  const chapter = chapters[currentChapter];

  return (
    <div
      className={`reader-view ${theme}`}
      style={
        {
          '--font-size': `${fontSize}px`,
          '--font-family':
            fontFamily === 'serif'
              ? 'Georgia, serif'
              : fontFamily === 'dyslexic'
                ? 'OpenDyslexic, sans-serif'
                : 'system-ui, sans-serif',
          '--line-height': lineHeight,
        } as React.CSSProperties
      }
    >
      {showToc && (
        <TocSheet
          chapters={chapters.map((c) => ({ title: c.title }))}
          currentChapter={currentChapter}
          onSelect={handleChapterChange}
          onClose={() => setShowToc(false)}
        />
      )}

      {showSettings && (
        <SettingsPanel
          theme={theme}
          fontSize={fontSize}
          fontFamily={fontFamily}
          lineHeight={lineHeight}
          apiKey={apiKey}
          onThemeChange={(t) => setTheme(t as Theme)}
          onFontSizeChange={setFontSize}
          onFontFamilyChange={(f) => setFontFamily(f as FontFamily)}
          onLineHeightChange={setLineHeight}
          onApiKeyChange={setApiKey}
          onClose={() => setShowSettings(false)}
        />
      )}

      {showAudioPanel && (
        <AudioPanel
          isPlaying={isTTSPlaying}
          speed={playbackSpeed}
          speeds={SPEEDS}
          onPlay={handlePlayTTS}
          onStop={handleStopTTS}
          onSpeedChange={handleSpeedChange}
          onGenerateAudio={handleGenerateAudio}
          onPlayGeneratedAudio={handlePlayGeneratedAudio}
          isGenerating={isGenerating}
          generationProgress={generationProgress}
          hasGeneratedAudio={
            currentBookId
              ? generatedAudioChapters.has(`${currentBookId}:${currentChapter}`)
              : false
          }
          onClose={() => setShowAudioPanel(false)}
        />
      )}

      <div
        className="reader-content"
        ref={contentRef}
        onScroll={(e) => handleScroll((e.target as HTMLDivElement).scrollTop)}
        onClick={handleContentClick}
      >
        {chapter && (
          <article className="chapter-article" role="article">
            <header>
              <h1 className="chapter-title">{chapter.title}</h1>
            </header>
            <section
              className="chapter-html"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(chapter.htmlContent),
              }}
            />
          </article>
        )}
      </div>

      <nav className="reader-nav">
        <button
          className="nav-btn"
          onClick={() => setShowToc(true)}
          aria-label="Table of Contents"
        >
          ☰
        </button>
        <button
          className="nav-btn"
          onClick={() => setShowAudioPanel(true)}
          aria-label="Audio controls"
        >
          🔊
        </button>
        <button
          className="nav-btn"
          onClick={() => setShowSettings(true)}
          aria-label="Settings"
        >
          ⚙
        </button>
        <button
          className="nav-btn"
          onClick={handleBack}
          aria-label="Back to Library"
        >
          ←
        </button>
      </nav>

      {(isTTSPlaying || showAudioPanel) && (
        <MiniPlayer
          isPlaying={isTTSPlaying}
          chapterTitle={chapter?.title ?? ''}
          onPlay={handlePlayTTS}
          onStop={handleStopTTS}
        />
      )}
    </div>
  );
}

interface AudioPanelProps {
  isPlaying: boolean;
  speed: PlaybackSpeed;
  speeds: PlaybackSpeed[];
  onPlay: () => void;
  onStop: () => void;
  onSpeedChange: (speed: PlaybackSpeed) => void;
  onGenerateAudio: () => void;
  onPlayGeneratedAudio: () => void;
  isGenerating: boolean;
  generationProgress: string | null;
  hasGeneratedAudio: boolean;
  onClose: () => void;
}

function AudioPanel({
  isPlaying,
  speed,
  speeds,
  onPlay,
  onStop,
  onSpeedChange,
  onGenerateAudio,
  onPlayGeneratedAudio,
  isGenerating,
  generationProgress,
  hasGeneratedAudio,
  onClose,
}: AudioPanelProps) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>Audio Controls</h2>
          <button className="sheet-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="audio-panel">
          <div className="audio-section">
            <h3>Edge TTS (Free)</h3>
            <div className="audio-controls">
              <button className="play-btn" onClick={onPlay}>
                {isPlaying ? '⏸' : '▶'}
              </button>
              <button className="stop-btn" onClick={onStop}>
                ⏹
              </button>
            </div>
            <p className="audio-hint">
              Using Edge Text-to-Speech (built-in, free)
            </p>
          </div>
          <div className="audio-section">
            <h3>High-Quality MP3 (requires API key)</h3>
            <div className="audio-controls">
              <button
                className="play-btn"
                onClick={onPlayGeneratedAudio}
                disabled={!hasGeneratedAudio}
              >
                ▶
              </button>
              <button
                className="generate-btn"
                onClick={onGenerateAudio}
                disabled={isGenerating}
              >
                {isGenerating ? '⏳' : '🎙'}
              </button>
            </div>
            {generationProgress && (
              <p className="generation-progress">{generationProgress}</p>
            )}
            {hasGeneratedAudio && (
              <p className="audio-hint">MP3 ready for playback</p>
            )}
          </div>
          <div className="speed-selector">
            <span>Speed:</span>
            <div className="speed-buttons">
              {speeds.map((s) => (
                <button
                  key={s}
                  className={`speed-btn ${speed === s ? 'active' : ''}`}
                  onClick={() => onSpeedChange(s)}
                >
                  {s}x
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface MiniPlayerProps {
  isPlaying: boolean;
  chapterTitle: string;
  onPlay: () => void;
  onStop: () => void;
}

function MiniPlayer({
  isPlaying,
  chapterTitle,
  onPlay,
  onStop,
}: MiniPlayerProps) {
  return (
    <div className="mini-player">
      <div className="mini-player-info">
        <span className="mini-player-status">{isPlaying ? '🔊' : '⏸'}</span>
        <span className="mini-player-title">{chapterTitle}</span>
      </div>
      <div className="mini-player-controls">
        <button onClick={onPlay}>{isPlaying ? '⏸' : '▶'}</button>
        <button onClick={onStop}>⏹</button>
      </div>
    </div>
  );
}
