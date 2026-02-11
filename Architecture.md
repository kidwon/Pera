# Project: Pera (Fluent Japanese PWA)

## 1. Project Overview
You are an expert Full-Stack Architect building **"Pera"**, a high-performance Japanese dictionary and SRS (Spaced Repetition System) learning tool.
The goal of Pera is to make users "PeraPera" (fluent) through a **Mobile-First Experience** (PWA) and a **Hybrid Architecture**.

## 2. Technical Stack & Architecture (STRICT)

### A. Hybrid Architecture (Separation of Concerns)
This project uses a "Static/Dynamic" separation strategy. You must strictly adhere to this division:

1.  **Frontend (Next.js 14+):**
    * **Role:** UI rendering, Routing, PWA logic, Gesture handling.
    * **Framework:** Next.js (App Router), TypeScript, Tailwind CSS.
    * **UI Libs:** Shadcn/ui (Radix), Lucide-react.
    * **Mobile UX:** `vaul` (Drawer/Bottom Sheet), `@use-gesture/react` (Swipe gestures), `framer-motion`.
    * **State:** `convex/react` for user data.

2.  **Dynamic Data Layer (Convex):**
    * **Role:** User authentication, User data (Flashcards), SRS Algorithm (Anki/SM-2), Real-time sync.
    * **Language:** TypeScript.
    * **Constraint:** DO NOT perform heavy text analysis or search algorithms here. Only CRUD and SRS logic.

3.  **Static Engine Layer (Kotlin Microservice):**
    * **Role:** Dictionary Search, Fuzzy Matching, De-inflection (Grammar analysis).
    * **Framework:** Ktor (Server), Gradle (Kotlin DSL).
    * **Style:** **Functional Programming** (Use `io.arrow-kt:arrow-core`).
    * **Constraint:** Stateless. No database. In-memory or file-based (JMdict) search only.
    * **Output:** Returns raw dictionary data (JSON) to the Frontend.

## 3. Coding Standards & Patterns

### General
* **Mobile-First:** Always write CSS for mobile screens first, then use `md:` or `lg:` for desktop.
* **Type Safety:** Strict TypeScript in Frontend/Convex. Strong typing in Kotlin.

### Kotlin (Search Engine)
* **Functional Style:** Avoid `null`. Use `Option`, `Either`, or `Result` types from Arrow.kt.
* **Immutability:** Use `val` and immutable data structures (Data Classes).
* **Performance:** Optimize for read-heavy operations (Search).

### Frontend (Next.js)
* **Components:** Small, composable Client Components. Use Server Components for initial layout where possible.
* **Interactions:**
    * Use **Drawer (`Vaul`)** for details on mobile.
    * Use **Swipe Gestures** for SRS review cards (Left=Again, Right=Good).
    * Use `navigator.vibrate` for haptic feedback.

## 4. Workflow Rules
1.  **Identify the Layer:** Before writing code, determine if the logic belongs in `web/` (Next.js), `web/convex/` (DB), or `server/` (Kotlin).
2.  **No Logic Leakage:** Do not put SRS logic in Kotlin. Do not put Tokenizer logic in Convex.
3.  **JMdict ID:** Use the `ent_seq` (Entry Sequence) from JMdict as the primary key to link Convex Cards with Kotlin Dictionary Entries.

## 5. Development Phases
* **Phase 1 (MVP):** Basic Search (Kotlin) + Card Saving (Convex) + Mobile View.
* **Phase 2:** SRS Algorithm + Gesture UI.
* **Phase 3:** AI Features (LLM integration).

When generating code, always double-check: **"Is this mobile-friendly?"** and **"Is this in the correct architectural layer?"**