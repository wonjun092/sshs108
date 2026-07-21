# SSHS 108 TypeScript migration

The existing Flask application remains at the repository root. The new application lives in `web/` so it can be tested and deployed independently before the production cutover.

## Course material applied

- TypeScript strict types and interfaces
- React function components, state, effects, and one-way data flow
- REST-style route handlers with HTTP status codes
- Zod runtime validation for untrusted request data
- Mongoose schemas and MongoDB CRUD
- Route guards for authenticated pages
- Environment variables for secrets and external services

Koa and React Router from the lectures are not installed separately. Next.js App Router provides server middleware-style Route Handlers and file-system routing in one Vercel-compatible project.

## Local setup

```bash
cd web
pnpm install
copy .env.example .env.local
pnpm dev
```

Required variables:

- `MONGODB_URI`: MongoDB Atlas connection string
- `AUTH_SECRET`: at least 32 random characters

Google OAuth and Vercel Blob variables are reserved for the next migration phase. Never copy the secret currently committed in the Flask application.

## Validation

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## Legacy-data dry run

Keep exported production data outside Git. Then run:

```bash
pnpm migrate:legacy -- --source "C:\\path\\to\\mysite" --dry-run
```

After reviewing the counts and configuring `MONGODB_URI` for a test database, remove `--dry-run` to import users, posts, comments, and reservations. Existing plaintext passwords are hashed with bcrypt during import.

## Current milestone

Implemented:

- secure session foundation
- signup and login APIs
- user, post/comment, and reservation models
- notice, free, anonymous, and lost-item boards
- reservation storage
- responsive React UI

Still required before production:

- administrator approval UI/API
- Google OAuth and Sheets integration
- Vercel Blob upload and legacy upload migration
- quiz component migration
- production data rehearsal and cutover
