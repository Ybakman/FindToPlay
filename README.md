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

Requirements: Node.js 22+ and npm.

```bash
cp .env.example .env
npm install
npm run dev
```

Open `http://localhost:3000`. The database and sample data are created automatically at `data/football.db`.

The development fallback login is `admin` / `change-me-now`. Set a strong `ADMIN_PASSWORD` before first production startup; the password hash is created only when the admin table is empty. To recreate the initial admin locally, remove the development database.

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

