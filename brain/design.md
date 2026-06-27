# Design Documentation

## UI Philosophy
- **Human‑first**: Interfaces should feel like a natural extension of the user's workflow, reducing friction and cognitive load.
- **Clarity over flair**: Visual elements serve a purpose; unnecessary ornamentation is avoided.
- **Consistency**: Every component follows a unified visual language, reinforcing brand identity.

## UX Principles
- **Predictable interactions**: Actions produce expected outcomes; error states are clear and actionable.
- **Progressive disclosure**: Only essential information is shown initially; advanced options appear contextually.
- **Feedback loops**: Immediate visual/audible feedback for every user action.

## Visual Hierarchy
- Primary actions use the **primary** color and larger tap targets.
- Secondary actions use muted tones with subtle borders.
- Important status badges (e.g., `Locked`, `Error`) employ high‑contrast colors (red, orange).

## Typography
- **Font family**: `Inter` for UI, `Roboto` for body copy.
- **Scale**: 11 px (labels), 13 px (form fields), 15 px (body), 20 px (headings).
- **Weight**: 500 for regular text, 600‑700 for emphasis.

## Spacing System
- Base spacing unit: **4 px**.
- Margins/paddings are multiples of the base unit (4, 8, 12, 16, 24, 32 px).
- Consistent gutter of **16 px** between columns.

## Color System
| Role | Light Mode | Dark Mode |
|------|------------|----------|
| Primary | `#4f46e5` (Indigo‑600) | `#6366f1` (Indigo‑500) |
| Secondary | `#64748b` (Slate‑500) | `#94a3b8` (Slate‑400) |
| Success | `#10b981` (Emerald‑500) | `#34d399` (Emerald‑400) |
| Warning | `#f59e0b` (Amber‑500) | `#fbbf24` (Amber‑400) |
| Danger | `#ef4444` (Red‑500) | `#f87171` (Red‑400) |
| Background | `#f8fafc` | `#0f172a` |
| Surface | `rgba(255,255,255,0.08)` | `rgba(255,255,255,0.1)` |

## Component Design Rules
- **Buttons**: Minimum 44 px tap height, rounded corners (`var(--radius-md)`), consistent shadow for elevation.
- **Inputs**: Inline label, 1 px border, focus ring using `var(--primary)`.
- **Cards**: Glass‑morphism background with `backdrop-filter: blur(12px)`; subtle drop‑shadow.
- **Tables**: Alternating row colors, sticky header on scroll, actionable icons right‑aligned.

## Responsive Behavior
- **Mobile (≤ 640 px)**: Single‑column layout, collapsible side navigation, touch‑optimized controls.
- **Tablet (641‑1024 px)**: Two‑column layout, keep side navigation visible.
- **Desktop (> 1024 px)**: Full dashboard with persistent sidebar and expanded content areas.

## Accessibility Rules
- WCAG 2.1 AA compliance.
- All interactive elements have **ARIA labels** and **keyboard focus** visible.
- Contrast ratio ≥ 4.5:1 for text, ≥ 3:1 for UI components.
- Skip‑to‑content link at the top of each page.

## Interaction Principles
- **Micro‑animations** for state changes (e.g., loading spinners, toast fade‑in/out) with duration ≤ 200 ms.
- **Debounced input** for search fields (300 ms) to improve performance.
- **Optimistic UI** updates for non‑critical actions with rollback on error.

## Animation Philosophy
- Subtle, purpose‑driven motion; avoid distracting or overly elaborate effects.
- Use CSS `transition` for hover/focus; `keyframes` only for major state changes (e.g., modal entry).

## Consistency Guidelines
- Follow the same naming, spacing, and color tokens across all components.
- Reuse the `ui.js` utility helpers for badges, toasts, and modal rendering.
- Document any deviation in the `framework.md` conventions file.
