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
Raster images retain inline previews. Other attachments (including HTML, SVG,
and PDF) download with `nosniff` and a restrictive CSP, preventing the legacy
attachment endpoint from bypassing the HTML-page sandbox.

## Single-file HTML pages (`/baepo`)

Approved, active accounts can publish a UTF-8 `.html` or `.htm` file (up to
1 MiB) at `/<slug>`. The sidebar links to `/baepo`, where owners can list,
replace, and delete their own files. Administrators can manage every upload.
Published pages are **public**, including their source; never upload secrets or
personal information. Account status and role are checked against MongoDB on
every management request, so a stale session cannot retain revoked privileges.

Files live in the `htmldeployments` MongoDB collection, not the Vercel filesystem
or the existing attachment collection. No new production environment variables
or manual migrations are required: keep the existing `MONGODB_URI` and
`AUTH_SECRET`, and use Vercel Root Directory `web`. Each document uses its slug
as MongoDB's inherently unique `_id`. A single insert stores the HTML and claims
the path; concurrent attempts produce one success and HTTP 409 for the others,
without relying on asynchronous secondary-index creation. Updates and deletes
include owner authorization and a random revision in the atomic database filter.
Clients send the revision in `If-Match`; stale edits/deletes get HTTP 409. Deleting
then recreating a path also changes its revision.

Slugs are 1–48 lowercase ASCII letters/digits/hyphens with alphanumeric ends.
`next.config.ts` regenerates `src/lib/baepo-reserved.json` from root application
routes, route groups, metadata routes, and public assets on every build/dev start.
Explicit system and legacy names are reserved too. Rewrites/redirect aliases must
be added to the explicit set in `scripts/baepo-routes.ts`. Root dynamic routes
other than `[slug]` deliberately fail the build until their conflicts are reviewed.
If a later release reserves an existing upload's path, it cannot be served or
replaced anymore; its owner/admin can still list and delete it. The managed list
is paginated in groups of 50.

The public page wraps the upload in an iframe with only `sandbox="allow-scripts"`.
The HTML response also sends an HTTP CSP `sandbox allow-scripts`, including when
opened directly. The sandbox omits `allow-same-origin`, isolating application DOM,
cookies, and browser storage. CSP allows inline JavaScript/CSS and embedded
data/blob media, but blocks external scripts/resources, fetch/WebSocket, workers,
nested frames, objects, base URLs, and form submission. Popups, downloads, and
parent navigation are not permitted. Files needing CDNs, APIs, localStorage,
external fonts, or relative assets must be adapted into a self-contained file.
This is browser privilege isolation, not malware scanning or a CPU quota: an
uploaded page can still display misleading content or run expensive JavaScript,
and can navigate its own frame. The wrapper labels it as user-uploaded content;
administrators can remove abusive pages. No uploaded markup is injected into the
application DOM. Mutation APIs require a matching non-null Origin, check the
session and active user, cap the request stream before multipart parsing, and
validate the file's actual byte size, UTF-8 encoding, extension, and HTML marker.

Security references: [CSP sandbox](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/sandbox)
and [Mongoose uniqueness/index behavior](https://mongoosejs.com/docs/validation.html#the-unique-option-is-not-a-validator).

### HTML feature verification

```bash
pnpm test:baepo
pnpm test:english
pnpm typecheck
pnpm build
pnpm exec playwright install chromium
pnpm test:baepo:integration
```

The integration suite starts a temporary MongoDB and production Next.js server,
uses synthetic users only, and tests concurrent registration, stale writes,
ownership/admin permissions, revoked accounts, validation, public 404s, browser
isolation, and desktop/mobile management UI. The first run downloads a MongoDB
test binary; the package's install-time download is intentionally disabled.
To use an installed Chrome instead, set `PLAYWRIGHT_CHANNEL=chrome` for the test.
Screenshots are saved to ignored `test-results/`. Never point this suite at a
production database; it always creates its own temporary database.

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
