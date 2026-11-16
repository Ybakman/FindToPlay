# Thursday Football

A complete first version of a weekly amateur football site. It publishes fixtures and results, match reports, player-by-player stats, player-of-the-match awards, video embeds, and cumulative player profiles. A private server-rendered admin console keeps the content easy to maintain.

## Stack

- Node.js 22, TypeScript and Express 5
- EJS server-rendered pages with responsive custom CSS
- SQLite with WAL mode, foreign keys, migrations-on-start and zero external services
- Zod validation, Argon2 password hashing, database-backed sessions, CSRF protection, rate-limited login and Helmet security headers
- Vitest and Supertest

This is deliberately a small monolith: straightforward to deploy and operate for one football group, while keeping database, authentication, routes and presentation separated. SQLite can later be replaced with Postgres behind the query layer if traffic or concurrent editors grow.

## Local setup

Requirements: Node.js 22 or newer and npm.

```bash
git clone https://github.com/Ybakman/Football-Website.git
cd Football-Website
cp .env.example .env
npm ci
npm run dev
```

Open the public site at `http://localhost:3000` and the administrator sign-in at `http://localhost:3000/admin/login`. Change `PORT` in `.env` if port 3000 is unavailable.

### Database and first administrator

No database command is required. On the first startup, the app creates the SQLite file configured by `DATABASE_PATH` (default: `data/football.db`), applies its schema and inserts the chat-derived starter records. The `data/` directory and database are gitignored.

Before the first startup, configure these values in `.env`:

```dotenv
ADMIN_USERNAME=admin
ADMIN_PASSWORD=replace-with-a-long-unique-password
COOKIE_SECRET=replace-with-at-least-32-random-characters
```

The first startup creates one administrator using `ADMIN_USERNAME` and an Argon2 hash of `ADMIN_PASSWORD`. These variables do not overwrite an administrator already stored in the database. To intentionally recreate the initial local database and administrator, stop the app, delete `data/football.db`, then run `npm run dev` again. This also removes all locally entered games and players.

For development only, omitting the variables falls back to `admin` / `change-me-now` and a development cookie secret. Production startup refuses to initialize without `ADMIN_PASSWORD` and `COOKIE_SECRET`.

## Commands

```bash
npm run dev        # watch mode
npm run typecheck  # strict TypeScript checks
npm test           # automated integration tests
npm run build      # compile to dist/
npm start          # run the compiled production app
```

## Production notes

1. Set `NODE_ENV=production`, a long random `COOKIE_SECRET`, and a strong `ADMIN_PASSWORD`.
2. Mount the `data/` directory on persistent storage and back up `football.db`.
3. Terminate TLS at the hosting proxy. Production cookies are HTTPS-only.
4. Run `npm ci`, `npm run build`, then `npm start`.
5. Only YouTube and Vimeo are embedded; other valid video URLs are shown as safe external links.

## Seed content provenance

The initial football records are derived conservatively from the supplied November 2026 group-chat exports:

- The first game was Thursday 12 November, 9–10pm, with dark and white sides.
- The next game was planned for Thursday 19 November at the same time.
- The SoFive event video URL is preserved as an external link.
- Names are included only where a participant was identified in the conversation.
- The team-sheet images were omitted from the export, and the chat does not state the final score, exact lineups, positions, individual totals, or final player-of-the-match poll result. Those fields are intentionally shown as unknown rather than inferred.
- Phone numbers, pickup addresses and payment details from the chat are not stored or displayed.

Product assumptions and page organization are documented in [SITE_STRUCTURE.md](SITE_STRUCTURE.md).

