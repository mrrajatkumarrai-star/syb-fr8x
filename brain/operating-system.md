# Operating System Documentation

## Development Lifecycle
- **Idea → Specification → Implementation → Review → Merge → Deploy**
- All work begins with a task in the project board and a corresponding issue in the repository.
- Developers create a feature branch, implement changes, and run the local dev server (`npm run dev` or `powershell -ExecutionPolicy Bypass -File .\start_server.ps1`).
- Unit and integration tests must pass before a pull request is opened.

## Project Workflow
1. **Backlog Grooming** – Prioritize backlog items during weekly planning.
2. **Sprint Planning** – Select issues for the upcoming sprint; assign owners.
3. **Implementation** – Work on a feature branch, update documentation in `brain/` as needed.
4. **Code Review** – At least one peer reviews the PR, checks for lint, tests, and documentation updates.
5. **Merge** – After approval, the PR is merged to `main` and triggers the CI pipeline.
6. **Release** – A release tag is created (`vX.Y.Z`). The CI deploys the artifact to Vercel.

## Branching Strategy
- `main` – Production‑ready code, always deployable.
- `dev` – Integration branch for the current sprint.
- `feature/*` – Short‑lived branches for individual features or bugs.
- `hotfix/*` – Emergency fixes directly branched from `main`.

## Release Workflow
- **Version bump** – Follow semantic versioning. Update `package.json` and create a Git tag.
- **CI/CD** – GitHub Actions run lint, tests, and build the static site.
- **Vercel** – Automatic deployment on push to `main`; preview deployments on PRs.
- **Changelog** – Auto‑generated from commit messages using `standard-version`.

## Deployment Workflow
- The `vercel.json` defines the build output directory (`dist/`).
- Environment variables for Firebase and EmailJS are configured in Vercel's dashboard.
- Deployments are immutable; each preview URL is a distinct immutable build.

## Review Workflow
- **Static analysis** – ESLint with the rules defined in `.eslintrc.json`.
- **Automated tests** – Jest for unit tests, Playwright for e2e.
- **Manual QA** – QA engineers verify UI/UX against the `brain/design.md` guidelines.
- **Security review** – Check for new secrets, password handling, and lockout logic.

## Maintenance Procedures
- **Dependency updates** – Run `npm outdated` monthly; apply patches via PRs.
- **Bug triage** – Prioritized weekly; assign to upcoming sprint.
- **Technical debt** – Document in the `brain/extension.md` with target release.

## Backup Strategy
- The mock database lives in `localStorage`. Periodic snapshots are exported to a JSON file (`backup_YYYYMMDD.json`) via a hidden admin endpoint.
- Firebase backups are configured in the Firebase console with daily export to Google Cloud Storage.

## Rollback Strategy
- **Vercel** – Click the *Rollback* button on the deployment page to revert to a previous build.
- **Database** – Restore the latest JSON backup for the mock DB; for Firebase, use the point‑in‑time restore feature.

## Incident Response
1. **Detect** – Monitor alerts from Vercel (status page) and Firebase (error logs).
2. **Triage** – Assign an incident owner; investigate using the audit log (`auditLog` collection).
3. **Mitigate** – If a security issue, lock affected accounts and rotate secrets.
4. **Resolve** – Deploy a hotfix branch; mark the incident as resolved.
5. **Post‑mortem** – Document cause and action items in the project wiki and update `brain/operating-system.md` if processes change.

## Production Rules
- No **debug** statements (`console.log`) in production code; they must be removed or gated behind a `DEBUG` flag.
- All secret keys are stored as Vercel environment variables; never commit them.
- Feature toggles must default to **off** in production until verified.
- All UI changes must be reflected in the permanent documentation under `brain/`.

---

*The operating‑system document defines **how** the project is run, maintained, and evolved over time.*
