# Architecture Documentation

## Folder Structure
```
syb-fr8x/
├─ src/
│  ├─ components/          # UI components (lock-screen, users, compass, etc.)
│  ├─ services/            # Utility services (db.js, ui.js, config.js)
│  ├─ assets/              # Images, icons, fonts
│  └─ index.html           # Application entry point
├─ brain/                  # Permanent knowledge base (design, architecture, etc.)
├─ .github/                # CI/CD workflows
└─ package.json            # Project metadata and scripts
```

## Module Relationships
- **Components** import helpers from **services** (e.g., `ui.js` for toasts, `db.js` for data access).
- **Services** are pure modules with no UI dependencies.
- **Lock‑Screen**, **Users**, and **Compass** communicate via `sessionStorage` and share the same global state manager.

## Application Layers
1. **Presentation Layer** – Vanilla JS/HTML components rendered in the browser.
2. **Domain Layer** – Business logic resides in component methods and service utilities.
3. **Data Access Layer** – `db.js` abstracts the in‑memory mock database and persists to `localStorage`.

## State Flow
1. On load, `lock-screen.js` checks `sessionStorage` for an unlocked flag.
2. Successful login writes user identifiers to `sessionStorage`.
3. Subsequent components read the session to conditionally render admin or customer views.
4. UI actions (e.g., lock/unlock, KYC approval) invoke `saveDocument` to persist state.

## Data Flow
- All reads/writes go through the **Data Access Layer** (`getCollection`, `saveDocument`).
- Event‑driven updates trigger UI refresh via `refreshPanel` calls.

## Routing Strategy
- Single‑page app driven by URL query parameters (`?portal=customer`).
- Component rendering is controlled by `window.location.search` and internal tab state.

## Dependency Boundaries
- UI components must **not** import third‑party libraries directly; they rely on the lightweight utility functions provided by `services/`.
- External services (Firebase, Vercel) are encapsulated in `config.js` and accessed through dedicated wrapper functions.

## API Communication
- Currently uses **Firebase Realtime Database** via the Firebase SDK for persistence when configured.
- All API calls are wrapped in async helpers that return promises, allowing easy replacement with a REST layer.

## Firebase Integration
- `config.js` holds the Firebase project configuration.
- Authentication is handled manually; Firebase is used only for data storage and optional email sending via EmailJS.

## Vercel Deployment Model
- The app is a static site built on the `src/` folder.
- Vercel serves `index.html` and routes all unknown paths to the SPA entry point (fallback to `index.html`).
- Environment variables for Firebase/EmailJS are injected via Vercel's dashboard.

## Security Architecture
- Passwords are stored as **SHA‑256 hashes** (client‑side hashing before persisting).
- Login attempts are tracked; a lock after 4 failures.
- OTP reset flow includes time‑limited OTPs and email verification.
- Session data is stored in **sessionStorage**, cleared on logout.
- All communication with Firebase is over HTTPS; no secrets are exposed in the client bundle.

## Scalability Strategy
- The modular folder layout allows independent scaling of components.
- Data layer can be swapped to a server‑side API without affecting UI.
- Vercel’s edge caching and static serving ensure low latency for the SPA.

---

*This document describes the technical architecture of the project and is kept up‑to‑date automatically when structural changes occur.*
