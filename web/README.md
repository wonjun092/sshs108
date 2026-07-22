# SSHS108 Next.js migration

The Flask application remains at the repository root for rollback. The Vercel application lives in `web/` and deliberately preserves the original Flask routes, navigation, card layout, and workflows while replacing JSON/SQLite persistence with MongoDB.

## Preserved application features

- ID/password login, logout, signup request, and administrator approve/reject workflow
- Role rules for `admin`, `Teacher`, and students
- Notice scheduling, attachments, views, comments, edit, and delete
- Free and anonymous boards with the original visibility and role rules
- Separate found-item and lost-item boards with location filters
- Single and continuous outing applications, cancellation, and Monday–Thursday rules
- School Google OAuth and Google Sheets outing status/update flow
- My-page password change
- English vocabulary quiz and periodic-table quiz using the original standalone HTML/CSS/JavaScript
- Original hamburger sidebar links, external school-meal link, and responsive card styling

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

Required for the outing/Google Sheets workflow:

- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_SPREADSHEET_ID`

The Google OAuth client's authorized redirect URI must include:

```text
https://YOUR_VERCEL_DOMAIN/api/google/callback
```

Never reuse or copy the Google secret historically committed in the Flask source. Rotate it first and store the replacement only in Vercel environment variables.

## Attachments

New attachments are stored in MongoDB with a 4 MB per-file limit because Vercel's filesystem is ephemeral. The original Flask UI still presents a normal file picker and attachment link.

## Validation

```bash
pnpm typecheck
pnpm lint
pnpm build
```

## Legacy-data migration

The migration script reads the repository-root JSON and SQLite files by default:

```bash
pnpm migrate:legacy -- --dry-run
pnpm migrate:legacy
```

Use `--source "C:\\path\\to\\mysite"` to import from another backup. It migrates active and pending users, hashes plaintext passwords with bcrypt, imports all post groups and comments, preserves views and timestamps, and imports future reservations.

Legacy upload URLs are retained, and the desktop backup's upload files are deployed from `public/legacy-uploads`. A backup filename carrying the Windows duplicate suffix ` (1)` is normalized to the filename referenced by `notices.json` so the original attachment URL continues to work.

## Deployment order

1. Deploy the migration branch as Vercel Preview with Root Directory `web`.
2. Configure Preview environment variables and Atlas Network Access.
3. Run the legacy-data dry run, review counts, then import into the Preview database.
4. Test all roles and workflows.
5. Rotate/configure Google OAuth and test Sheets with the Preview callback URL.
6. Only after acceptance, merge the draft PR and schedule the production cutover.
