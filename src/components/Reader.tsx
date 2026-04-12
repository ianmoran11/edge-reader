import type { Chapter } from '../types';
import { sanitizeHtml } from '../utils/sanitize';

interface ReaderProps {
  bookTitle: string;
  chapters: Chapter[];
  currentChapter: number;
  scrollOffset: number;
  onChapterChange: (index: number) => void;
  onTocClick: () => void;
  onSettingsClick: () => void;
  onAudioClick: () => void;
  contentRef?: (el: HTMLDivElement | null) => void;
  onScroll?: (offset: number) => void;
}

export function Reader({
  bookTitle,
  chapters,
  currentChapter,
  scrollOffset,
  onChapterChange,
  onTocClick,
  onSettingsClick,
  onAudioClick,
  contentRef,
  onScroll,
}: ReaderProps) {
  const chapter = chapters[currentChapter];

  return (
    <div className="reader-view">
      <div
        className="reader-content"
        ref={contentRef}
        onScroll={(e) => {
          const target = e.target as HTMLDivElement;
          onScroll?.(target.scrollTop);
        }}
      >
        {chapter && (
          <>
            <h1 className="chapter-title">{chapter.title}</h1>
            <div
              className="chapter-html"
              dangerouslySetInnerHTML={{
                __html: sanitizeHtml(chapter.htmlContent),
              }}
            />
          </>
        )}
      </div>

      <nav className="reader-nav">
        <button
          className="nav-btn"
          onClick={onTocClick}
          aria-label="Table of Contents"
        >
          ☰
        </button>
        <button
          className="nav-btn"
          onClick={onAudioClick}
          aria-label="Audio controls"
        >
          🔊
        </button>
        <button
          className="nav-btn"
          onClick={onSettingsClick}
          aria-label="Settings"
        >
          ⚙
        </button>
      </nav>
    </div>
  );
}

interface TocSheetProps {
  chapters: { title: string }[];
  currentChapter: number;
  onSelect: (index: number) => void;
  onClose: () => void;
}

export function TocSheet({
  chapters,
  currentChapter,
  onSelect,
  onClose,
}: TocSheetProps) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>Table of Contents</h2>
          <button className="sheet-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="toc-list">
          {chapters.map((ch, i) => (
            <button
              key={i}
              className={`toc-item ${i === currentChapter ? 'active' : ''}`}
              onClick={() => {
                onSelect(i);
                onClose();
              }}
            >
              {ch.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

interface SettingsPanelProps {
  theme: string;
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  apiKey: string;
  onThemeChange: (theme: string) => void;
  onFontSizeChange: (size: number) => void;
  onFontFamilyChange: (family: string) => void;
  onLineHeightChange: (height: number) => void;
  onApiKeyChange: (key: string) => void;
  onClose: () => void;
}

export function SettingsPanel({
  theme,
  fontSize,
  fontFamily,
  lineHeight,
  apiKey,
  onThemeChange,
  onFontSizeChange,
  onFontFamilyChange,
  onLineHeightChange,
  onApiKeyChange,
  onClose,
}: SettingsPanelProps) {
  return (
    <div className="sheet-overlay" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()}>
        <div className="sheet-header">
          <h2>Settings</h2>
          <button className="sheet-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="settings-content">
          <div className="setting-group">
            <label>Theme</label>
            <div className="theme-buttons">
              {['light', 'dark', 'night'].map((t) => (
                <button
                  key={t}
                  className={`theme-btn ${theme === t ? 'active' : ''}`}
                  onClick={() => onThemeChange(t)}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>
          </div>
          <div className="setting-group">
            <label>Font Size: {fontSize}px</label>
            <input
              type="range"
              min="14"
              max="24"
              step="2"
              value={fontSize}
              onChange={(e) => onFontSizeChange(Number(e.target.value))}
            />
          </div>
          <div className="setting-group">
            <label>Font Family</label>
            <select
              value={fontFamily}
              onChange={(e) => onFontFamilyChange(e.target.value)}
            >
              <option value="serif">Serif (Georgia)</option>
              <option value="sans-serif">Sans-serif (System)</option>
              <option value="dyslexic">Dyslexic</option>
            </select>
          </div>
          <div className="setting-group">
            <label>Line Height</label>
            <div className="line-height-buttons">
              {[1.4, 1.6, 1.8, 2.0].map((lh) => (
                <button
                  key={lh}
                  className={`lh-btn ${lineHeight === lh ? 'active' : ''}`}
                  onClick={() => onLineHeightChange(lh)}
                >
                  {lh}
                </button>
              ))}
            </div>
          </div>
          <div className="setting-group">
            <label>DeepInfra API Key</label>
            <input
              type="password"
              placeholder="Enter your API key for high-quality audio"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                border: '1px solid var(--border)',
                borderRadius: '8px',
              }}
            />
            <p style={{ fontSize: '12px', marginTop: '4px', opacity: 0.7 }}>
              For generating high-quality MP3 audio. Stored locally.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
