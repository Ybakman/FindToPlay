# Site structure and product assumptions

## Product assumptions

- One recurring amateur group plays a weekly internal game, usually with two colour-based teams.
- Public visitors can browse everything; only one trusted administrator needs write access in version one.
- A “game” may be scheduled, played or cancelled. Played games can have a score, report, video, player of the match and per-player goals/assists.
- Cumulative player totals are calculated from appearances, never copied into editable counters.
- A player can be marked inactive without losing history.
- Images are optional remote URLs. A styled initials placeholder keeps every profile complete without requiring file storage.
- YouTube and Vimeo links receive privacy-conscious embeds; other valid URLs remain external watch links.
- Sample records are illustrative because the supplied chat exports were unavailable at their given filesystem paths during implementation.

## Public information architecture

| Route | Purpose |
| --- | --- |
| `/` | Next fixture, latest result and leading scorers |
| `/matches` | Complete reverse-chronological game archive |
| `/matches/:id` | Score, report, video, player of the match and player stats |
| `/players` | Active squad with cumulative headline stats |
| `/players/:id` | Profile, totals and game-by-game log |

## Admin information architecture

| Route | Purpose |
| --- | --- |
| `/admin/login` | Rate-limited administrator sign-in |
| `/admin` | Game and player control room |
| `/admin/players/new` | Add a profile |
| `/admin/players/:id/edit` | Edit or deactivate a profile |
| `/admin/matches/new` | Add a fixture or result |
| `/admin/matches/:id/edit` | Edit game details, report, video and award |
| `/admin/matches/:id/stats` | Enter both teams and all player goals/assists in one table |

## Repository map

```text
src/
  app.ts            Express configuration, validation and routes
  auth.ts           Database sessions, secure cookie and CSRF checks
  db.ts             Schema, seed data and aggregate queries
  server.ts         Runtime entry point
  app.test.ts       Public and admin integration tests
views/
  admin/            Server-rendered admin screens
  partials/         Shared document header and footer
  *.ejs             Public pages
public/stylesheets/
  football.css      Responsive design system and all page styles
data/               Runtime SQLite database (gitignored)
```

## Data relationships

- `players` stores profile information and active status.
- `matches` stores fixture/result information and optionally references the awarded player.
- `appearances` joins players to matches, records their team and stores goals/assists.
- `admins` stores Argon2 hashes only.
- `sessions` stores random session IDs, CSRF tokens and expiries; the browser receives only a signed, HTTP-only cookie.

Deleting a match cascades its appearances. Deleting a player cascades their appearances and clears any player-of-the-match reference, although version one intentionally exposes deactivation rather than destructive deletion.
