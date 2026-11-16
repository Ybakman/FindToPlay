import Database from "better-sqlite3";
import argon2 from "argon2";
import fs from "node:fs";
import path from "node:path";

export type Db = Database.Database;

export async function createDatabase(filename = process.env.DATABASE_PATH ?? "data/football.db") {
  if (filename !== ":memory:") fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new Database(filename);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY, username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY, admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
      csrf_token TEXT NOT NULL, expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS players (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, nickname TEXT NOT NULL DEFAULT '',
      position TEXT NOT NULL CHECK(position IN ('Unspecified','Goalkeeper','Defender','Midfielder','Forward')),
      shirt_number INTEGER, bio TEXT NOT NULL DEFAULT '', photo_url TEXT NOT NULL DEFAULT '',
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY, played_at TEXT NOT NULL, venue TEXT NOT NULL,
      home_name TEXT NOT NULL, away_name TEXT NOT NULL,
      home_score INTEGER NOT NULL DEFAULT 0 CHECK(home_score >= 0),
      away_score INTEGER NOT NULL DEFAULT 0 CHECK(away_score >= 0),
      score_known INTEGER NOT NULL DEFAULT 1 CHECK(score_known IN (0,1)),
      status TEXT NOT NULL CHECK(status IN ('scheduled','played','cancelled')),
      report TEXT NOT NULL DEFAULT '', video_url TEXT NOT NULL DEFAULT '',
      potm_player_id INTEGER REFERENCES players(id) ON DELETE SET NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS appearances (
      match_id INTEGER NOT NULL REFERENCES matches(id) ON DELETE CASCADE,
      player_id INTEGER NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      team TEXT NOT NULL CHECK(team IN ('home','away')),
      goals INTEGER NOT NULL DEFAULT 0 CHECK(goals >= 0),
      assists INTEGER NOT NULL DEFAULT 0 CHECK(assists >= 0),
      PRIMARY KEY(match_id, player_id)
    );
    CREATE INDEX IF NOT EXISTS idx_matches_played_at ON matches(played_at DESC);
    CREATE INDEX IF NOT EXISTS idx_appearances_player ON appearances(player_id);
  `);
  const matchColumns = db.prepare("PRAGMA table_info(matches)").all() as { name: string }[];
  if (!matchColumns.some((column) => column.name === "score_known")) {
    db.exec("ALTER TABLE matches ADD COLUMN score_known INTEGER NOT NULL DEFAULT 1 CHECK(score_known IN (0,1))");
  }
  await seed(db);
  return db;
}

async function seed(db: Db) {
  if ((db.prepare("SELECT count(*) AS n FROM admins").get() as { n: number }).n === 0) {
    if (process.env.NODE_ENV === "production" && !process.env.ADMIN_PASSWORD) {
      throw new Error("ADMIN_PASSWORD is required when creating the production database");
    }
    const password = process.env.ADMIN_PASSWORD ?? "change-me-now";
    db.prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)")
      .run(process.env.ADMIN_USERNAME ?? "admin", await argon2.hash(password));
  }
  if ((db.prepare("SELECT count(*) AS n FROM players").get() as { n: number }).n > 0) return;
  const addPlayer = db.prepare(
    "INSERT INTO players (name,nickname,position,shirt_number,bio) VALUES (?,?,?,?,?)"
  );
  const players = [
    ["Yavuz", "", "Unspecified", null, ""],
    ["Metehan Oguz", "", "Unspecified", null, ""],
    ["Alper", "", "Unspecified", null, ""],
    ["Bahadır Barlas", "", "Unspecified", null, ""],
    ["Yiğit Türkmen", "", "Unspecified", null, ""],
    ["Sriram", "", "Unspecified", null, ""],
    ["Dulce", "", "Unspecified", null, ""],
    ["Jesus", "", "Unspecified", null, ""],
    ["Pranav Kumar", "", "Unspecified", null, ""],
    ["Ege", "", "Unspecified", null, ""],
    ["Amir", "", "Unspecified", null, ""]
  ];
  const insert = db.transaction(() => players.forEach((p) => addPlayer.run(...p)));
  insert();
  const match = db.prepare(`INSERT INTO matches
    (played_at,venue,home_name,away_name,home_score,away_score,score_known,status,report,video_url,potm_player_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)`);
  match.run(
    "2026-11-12T21:00", "SoFive (location shared in group chat)", "Dark", "White", 0, 0, 0, "played",
    "The first game of the season was arranged for 9–10pm. The group planned a 6v6 game, with dark and white sides. A post-match player-of-the-match poll nominated Dulce, Sriram, Jesus and Ege, but the export does not include a final result. One participant praised Jesus for his goals, while another highlighted Metehan’s header; neither message provides a verified total. The score, team sheet and individual totals were not available in the chat text.",
    "https://webapp.sofive.com/event/1173037", null
  );
  match.run(
    "2026-11-19T21:00", "SoFive (location shared in group chat)", "Dark", "White", 0, 0, 0, "scheduled",
    "The group planned to return at the same time the following Thursday. Attendance and teams were still being confirmed in the available export.", "", null
  );
}

export function playerRows(db: Db, activeOnly = false) {
  return db.prepare(`
    SELECT p.*, count(a.match_id) appearances, coalesce(sum(a.goals),0) goals,
      coalesce(sum(a.assists),0) assists,
      count(CASE WHEN m.potm_player_id=p.id THEN 1 END) potm_awards
    FROM players p LEFT JOIN appearances a ON a.player_id=p.id
    LEFT JOIN matches m ON m.id=a.match_id
    ${activeOnly ? "WHERE p.active=1" : ""}
    GROUP BY p.id ORDER BY goals DESC, assists DESC, p.name
  `).all();
}

export function matchRows(db: Db) {
  return db.prepare(`
    SELECT m.*, p.name potm_name,
      (SELECT count(*) FROM appearances a WHERE a.match_id=m.id) player_count
    FROM matches m LEFT JOIN players p ON p.id=m.potm_player_id
    ORDER BY m.played_at DESC
  `).all();
}
