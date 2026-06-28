# Framework Documentation

## Coding Standards
- **ES2022** syntax; use `let`/`const`, arrow functions, async/await.
- Enforce **strict mode** (`"use strict";`).
- Prefer **named exports** for clarity.
- No global variables; all state lives in modules or `sessionStorage`.
- Use **single‑quote** strings, 2‑space indentation, trailing commas.

## Naming Conventions
- Files: kebab‑case (`lock-screen.js`).
- Classes/Components: PascalCase (`LockScreen`).
- Functions/Variables: camelCase (`saveDocument`).
- Constants: UPPER_SNAKE_CASE (`MAX_LOGIN_ATTEMPTS`).

## Folder Conventions
- `src/components/` – UI components, each in its own file.
- `src/services/` – Pure services (data, UI helpers, config).
- `src/assets/` – Static assets (icons, fonts, images).
- `brain/` – Permanent knowledge base (design, architecture, etc.).

## File Conventions
- Include a header comment with purpose and author.
- Export a **default** if the module provides a single class/component; otherwise named exports.
- Keep files under **300 lines** where possible; split large modules.

## Component Conventions
- Render UI via `render()` that returns a DOM element.
- Separate **template** (`innerHTML`) from **event wiring** (`setupEventHandlers`).
- Provide a **public API** (`onUnlocked`) for parent communication.
- Use `ui.js` utilities for toasts, badges, and modals to maintain visual consistency.

## Error Handling
- All async calls wrapped in `try/catch` with user‑friendly messages via `showToast`.
- Log technical details to `auditLog` for debugging.
- Re‑throw only when the error is unrecoverable.

## Logging
- Use `console.debug` for development; `showToast` for UI‑visible logs.
- Persist security‑relevant events to `auditLog` collection.

## Testing Strategy
- Unit tests located in `tests/` using **Jest** (or native browser testing). Focus on:
  - Service functions (`hashPassword`, `saveDocument`).
  - Component state transitions (login success/failure, lockout).
- End‑to‑end tests with **Playwright** for UI flows (login, KYC approval, OTP reset).

## Commit Conventions
- Follow **Conventional Commits** (`type(scope): description`).
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`.
- Include issue number `#123` when applicable.

## Documentation Conventions
- Every public function must have a JSDoc comment.
- High‑level design docs live in `brain/` (design, architecture, blueprint, etc.).
- Inline component docs reference these core documents via markdown links.

---

*This framework outlines **how** developers should write, organize, and test code to keep the project maintainable and scalable.*
