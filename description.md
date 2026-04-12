Act as a Senior Technical Product Manager. Your task is to generate a comprehensive Product Requirements Document (PRD) in Markdown format (named `PRD.md`) based on the product description and feature list below. 

The document should be highly structured, technical, and ready to be used by a development team.

# Product Overview
The product is a mobile-optimized Progressive Web App (PWA) designed to manage, read, and listen to ebooks. The primary goal is to provide a seamless reading experience while heavily leveraging Text-to-Speech (TTS) capabilities—specifically prioritizing Microsoft Edge's native browser TTS, while offering an extensible backend for high-fidelity API-driven audio generation. All user data and libraries are managed locally to ensure privacy and offline accessibility.

# Core Requirements & Features

1. Content Ingestion & Local Data Management
- Ebook Conversion: The app must accept uploaded ebook files (e.g., EPUB) and parse/convert them into a web-readable format.
- Metadata Extraction: Automatically extract cover images, author names, and titles from the ebook files to populate the library UI.
- Content Structure & Navigation: Books must be logically split by chapters, and the app must parse and display the Table of Contents (ToC) for direct navigation.
- Local Library: All data (books, generated audio, progress, settings) must be stored locally on the user's device (e.g., via IndexedDB). 
- Storage Quota Management: The app must monitor local storage capacity and proactively warn the user before uploading large files or generating audio that might exceed browser limits.
- Backup & Restore: Implement an export/import feature (e.g., JSON/Zip) allowing users to back up their entire library and state, protecting against accidental browser cache clearing.

2. Text-to-Speech (TTS) Engine & Audio Integration
- Primary TTS: Rely on Microsoft Edge's native browser TTS capability as the primary reading engine.
- Secondary TTS (Audio Generation): Include architecture to call external APIs (specifically the DeepInfra API using the `kokoro-82m` model) to generate, download, and locally store TTS MP3 files for specific books or chapters.
- Media Session API: Essential integration to allow audio controls (play, pause, skip) on the phone's lock screen and system notification tray, enabling background playback when the screen is locked.
- Playback Controls: Support variable playback speeds (e.g., 1x, 1.25x, 1.5x, 2x) for both Edge TTS and generated MP3 audio.

3. User Interface & Reading Experience
- Mobile-First PWA: Hosted via Vercel, the UI/UX must be strictly optimized for phone use and structured so users can install it to their home screen.
- Progress Tracking: Continuously save the user's exact reading position or audio timestamp locally to resume exactly where they left off.
- Customization: 
  - Themes: Must include Light, Dark, and a specific Night-time (low-contrast/red-tinted) color theme.
  - Typography: Aspects of the font (size, family, line height) must be highly configurable by the user.

# Required PRD Structure
Please format the `PRD.md` using the following sections:
1. Executive Summary & Vision
2. Target Audience & Use Cases (User Stories)
3. Functional Requirements (broken down by Library, Reader, Data Management, and TTS capabilities)
4. Non-Functional Requirements (Performance, Local Storage limits, PWA criteria)
5. Technical Architecture & Stack (Vercel, IndexedDB strategy, Media Session API, DeepInfra API integration)
6. UI/UX Specifications (Themes, Typography, Mobile navigation)
7. Future Scope / Out of Bounds
8. Create a comprehensive list of tasks to implement this. 

Ensure the tone is professional, definitive, and clearly outlines the boundaries of the MVP.
