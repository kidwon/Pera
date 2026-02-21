# PERA Project Context & AI Memory

> **IMPORTANT FOR AI AGENTS:** If you are a new AI session joining this project, READ THIS FILE FIRST. It contains critical architectural decisions, commands, and known issues that will prevent regressions and save debugging time.

## 🎯 Project Overview
Pera is a full-stack Japanese language learning application featuring dictionary lookup, flashcards, global libraries, and spaced repetition (SRS).

## 🏗 Tech Stack & Architecture
- **Frontend**: Next.js (React), TailwindCSS
- **Backend**: Ktor (Kotlin 1.9), Jackson XML parsing 
- **Database**: Convex (Serverless real-time database)
- **Data Source**: JMdict (`jmdict_full.xml`), JLPT vocab lists. The backend parses this into `dictionary_snapshot.json.gz` to be served to the frontend.

## 💻 Essential Commands

### Backend (Ktor)
- **Start the Server**:
  ```bash
  cd server
  ./gradlew run
  ```
  *(Note: The server runs on Port **8082** to avoid conflicts. All frontend API calls point to this port via `NEXT_PUBLIC_API_URL`)*

- **Build Dictionary Snapshot (CRITICAL)**:
  ```bash
  cd server
  ./gradlew buildDictionary
  ```
  *(Note: NEVER run the raw script without the Gradle task. The `buildDictionary` task is explicitly configured with `-Xmx2g` memory to prevent `OutOfMemoryError` when parsing the massive `jmdict_full.xml`).*

### Frontend (Next.js)
- **Start Development Server**:
  ```bash
  cd web
  npm run dev
  ```

## 🚨 Known Gotchas & Historical Decisions

### 1. Convex Schema Backward Compatibility
- The `meanings` array inside the `cards` table has evolved (e.g., from a single `gloss` string, to a `glosses` map, and now adding `tags`).
- **CRITICAL RULE**: Always keep old fields as `v.optional()` in `convex/schema.ts` and ensure frontend renderers (like `StudyPage` and `SearchPage`) have fallback logic for legacy cards, otherwise the UI will crash for older users.

### 2. JMdict XML Parsing (Jackson)
- Dealing with `<gloss xml:lang="eng">` required special Jackson annotation handling.
- The dictionary contains highly specific/slang meanings (e.g., under "猫" it lists "geisha", "shamisen", "bottom"). We DO NOT delete these. Instead, we extract `<misc>` and `<pos>` tags into a `tags` array on the backend and use a frontend Settings menu (`visibleLanguages`) to filter out noise while preserving data integrity.

### 3. State Management Sync
- Adding a dictionary entry to a user's deck (`handleAddMeaning`) passes the *exact* legacy layout plus new mapping to maintain sync with `convex/cards.ts` mutations.
