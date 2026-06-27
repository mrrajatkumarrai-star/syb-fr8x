# Blueprint Documentation

## Project Vision
Create a modern, secure, and highly‑responsive freight forwarding SaaS platform that enables freight forwarders, shippers, and logistics partners to collaborate through a unified **CargoPulse** portal. The system should provide end‑to‑end visibility, KYC management, and operational workflow automation while maintaining a premium user experience.

## Product Goals
- **Security‑First**: Encrypted credential storage, lockout after 4 failed attempts, OTP‑based password recovery.
- **User‑Centric**: Separate staff and customer portals with intuitive UI & accessible design.
- **Scalable Architecture**: Modular codebase that can be extended with plugins and scale on Vercel.
- **Operational Efficiency**: Real‑time dashboards, audit logs, and notification system for administrators.
- **Maintainability**: Clear documentation (brain/), coding conventions, and automated testing.

## Core Features
| Feature | Description |
|---------|-------------|
| Secure Login | Email/password authentication with SHA‑256 hashing, lockout, and OTP reset. |
| Role‑Based Access | Staff (Super Admin, Operations, Finance) vs. Customer (CargoPulse client) with distinct UI. |
| KYC Management | Customers submit KYC documents; admins approve/reject; status badges (`Pending`, `Approved`, `Rejected`, `Locked`). |
| Dashboard & Reports | Real‑time metrics, request tracking, and financial summaries. |
| Notification Center | In‑app alerts and email notifications for lockouts, approvals, and system events. |
| Audit Logging | Immutable logs of security events, account changes, and admin actions. |
| Extensible Plugin System | Future modules (e.g., Rate Calculator, Shipment Tracking) can be added without core changes. |

## Modules Overview
- **Lock‑Screen** – Authentication gateway handling staff & customer logins.
- **Users** – Staff management UI with password edit and unlock capabilities.
- **Compass** – Admin dashboard for KYC review, request handling, and user assignments.
- **Services** – `db.js` (data access), `ui.js` (UI helpers), `config.js` (environment config).
- **Assets** – Icons, images, and fonts used across the UI.

## User Roles & Permissions
| Role | Permissions |
|------|-------------|
| Super Admin | Full access to all modules, user unlock, audit log view, system settings. |
| Operations | View/approve KYC, manage customers, view dashboards. |
| Finance | Access financial reports, export data. |
| Customer (CargoPulse) | View own dashboard, submit KYC, request services. |

## Core Workflows
1. **Login** – Users enter credentials → hashed verification → session stored.
2. **KYC Submission** – Customer registers → fills KYC form → admin reviews → status updates.
3. **Lockout & Unlock** – After 4 failed attempts → account locked → Super Admin unlocks via Users or Compass UI.
4. **Password Reset** – Forgot password → OTP emailed → OTP verification → new password set.
5. **Audit Logging** – All security‑related actions are persisted to `auditLog` collection.

## Future Roadmap
- **Plugin Marketplace** – Allow third‑party extensions.
- **Advanced Analytics** – Integrate BigQuery for reporting.
- **Multi‑Tenant Support** – Separate data partitions per organization.
- **Mobile App** – Native iOS/Android client using the same API.
- **Internationalization** – Multi‑language UI support.

## Assumptions & Constraints
- The application runs as a static SPA on Vercel; no server‑side rendering.
- Firebase is used as the primary data store; EmailJS for email dispatch unless configured.
- Browser environment with Web Crypto API for password hashing.
- Users are expected to have modern browsers with ES6 support.

---

*The blueprint defines **what** the system does, its business logic, and strategic direction.*
