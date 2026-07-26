# GymVault

GymVault is a multi-tenant gym management platform with an Express/PostgreSQL API and a React/Vite PWA.

## Repository layout

- `backend/` - API entry implementation, routes, middleware, runtime database configuration, and shared backend utilities.
- `database/` - PostgreSQL schema bootstrap and the physical-table RLS/default-deny policy inventory.
- `operations/jobs/` - scheduled retention, notification, payroll, expiry, and backup jobs.
- `operations/scripts/` - development launchers, smoke tests, security checks, and operational tools.
- `frontend/` - React/Vite PWA deployed through Vercel.
- `docs/` - maintained architecture and production operations documentation.
- `uploads/` - runtime-generated profile content; ignored by Git and served only through the backend's constrained upload route.
- `server.js` - stable compatibility entry used by npm and PM2; delegates to `backend/server.js`.

Root deployment manifests and package files stay at the repository root so Render, PM2, npm, and Vercel retain their existing entry points.

## Commands

```powershell
npm install
npm run dev
npm run dev:all
npm test
npm run check:repo-layout
npm run check:request-schemas
npm run check:security-events
npm run check:image-safety
npm run check:tenant-context
npm run check:tenant-rls
npm run smoke:backend
npm run smoke:production
npm --prefix frontend run lint
npm --prefix frontend run build
```

`npm run dev` starts the API on its configured port. `npm run dev:all` starts the API and Vite development server together. Production uses `npm run start:render`, which keeps `ecosystem.config.js` and the root `server.js` compatibility entry unchanged.

## Configuration

Keep local and production configuration in untracked environment variables. Never commit `.env` files. Provider and production requirements are documented in [docs/PRODUCTION_RESTART_RUNBOOK.md](docs/PRODUCTION_RESTART_RUNBOOK.md).

The database bootstrap is [database/init.sql](database/init.sql). Any physical public-schema table change must update [database/tenantTablePolicy.js](database/tenantTablePolicy.js) in the same change.

See [docs/GYMVAULT.md](docs/GYMVAULT.md) for the full product and architecture guide.
