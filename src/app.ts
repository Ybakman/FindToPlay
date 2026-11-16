import express, { type Request, type Response } from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import argon2 from "argon2";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import type { Db } from "./db.js";
import { matchRows, playerRows } from "./db.js";
import {
  createSession, destroySession, requireAdmin, requireCsrf, sessionMiddleware
} from "./auth.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const idSchema = z.coerce.number().int().positive();
const webUrl = z.string().max(500).refine((value) => {
  try { return ["http:", "https:"].includes(new URL(value).protocol); } catch { return false; }
}, "Enter a valid http or https URL");
const optionalUrl = z.union([z.literal(""), webUrl]);
const playerSchema = z.object({
  name: z.string().trim().min(2).max(80),
  nickname: z.string().trim().max(40).default(""),
  position: z.enum(["Unspecified", "Goalkeeper", "Defender", "Midfielder", "Forward"]),
  shirt_number: z.union([z.literal(""), z.coerce.number().int().min(1).max(99)]),
  bio: z.string().trim().max(500).default(""),
  photo_url: optionalUrl.default(""),
  active: z.coerce.number().int().min(0).max(1).default(1)
});
const matchSchema = z.object({
  played_at: z.string().min(10).max(30),
  venue: z.string().trim().min(2).max(120),
  home_name: z.string().trim().min(1).max(40),
  away_name: z.string().trim().min(1).max(40),
  home_score: z.coerce.number().int().min(0).max(99),
  away_score: z.coerce.number().int().min(0).max(99),
  score_known: z.coerce.number().int().min(0).max(1),
  status: z.enum(["scheduled", "played", "cancelled"]),
  report: z.string().trim().max(5000).default(""),
  video_url: optionalUrl.default(""),
  potm_player_id: z.union([z.literal(""), z.coerce.number().int().positive()])
});

function parseId(raw: unknown) {
  const parsed = idSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

function embedUrl(url: string) {
  try {
    const parsed = new URL(url);
    if (["youtube.com", "www.youtube.com", "youtu.be"].includes(parsed.hostname)) {
      const id = parsed.hostname === "youtu.be" ? parsed.pathname.slice(1) : parsed.searchParams.get("v");
      return id?.match(/^[\w-]{6,20}$/) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (["vimeo.com", "www.vimeo.com"].includes(parsed.hostname)) {
      const id = parsed.pathname.split("/").filter(Boolean)[0];
      return id?.match(/^\d+$/) ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {}
  return null;
}

export function createApp(db: Db) {
  if (process.env.NODE_ENV === "production" && !process.env.COOKIE_SECRET) {
    throw new Error("COOKIE_SECRET is required in production");
  }
  const app = express();
  app.disable("x-powered-by");
  if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);
  app.set("view engine", "ejs");
  app.set("views", path.join(root, "views"));
  app.locals.formatDate = (value: string) =>
    new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
      .format(new Date(value));
  app.locals.formatTime = (value: string) =>
    new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
  app.use(helmet({
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    contentSecurityPolicy: {
      directives: {
        "frame-src": ["'self'", "https://www.youtube-nocookie.com", "https://player.vimeo.com"],
        "img-src": ["'self'", "data:", "https:"]
      }
    }
  }));
  app.use(express.urlencoded({ extended: false, limit: "50kb" }));
  app.use(cookieParser(process.env.COOKIE_SECRET ?? "development-only-cookie-secret-change-me"));
  app.use(sessionMiddleware(db));
  app.use(express.static(path.join(root, "public"), { maxAge: process.env.NODE_ENV === "production" ? "1d" : 0 }));

  app.get("/", (_req, res) => {
    const matches = matchRows(db) as any[];
    const next = db.prepare("SELECT * FROM matches WHERE status='scheduled' ORDER BY played_at LIMIT 1").get();
    const latest = matches.find((m) => m.status === "played");
    const leaders = playerRows(db, true).slice(0, 5);
    res.render("site-home", { title: "Home", next, latest, leaders });
  });

  app.get("/matches", (_req, res) =>
    res.render("matches", { title: "Games", matches: matchRows(db) }));

  app.get("/matches/:id", (req, res) => {
    const id = parseId(req.params.id);
    const match = id && db.prepare(`
      SELECT m.*, p.name potm_name, p.nickname potm_nickname, p.position potm_position
      FROM matches m LEFT JOIN players p ON p.id=m.potm_player_id WHERE m.id=?
    `).get(id) as any;
    if (!match) return res.status(404).render("error", { title: "Game not found", message: "That game does not exist." });
    const appearances = db.prepare(`
      SELECT a.*, p.name, p.nickname, p.position, p.shirt_number
      FROM appearances a JOIN players p ON p.id=a.player_id
      WHERE a.match_id=? ORDER BY a.team, a.goals DESC, p.name
    `).all(id);
    res.render("match", { title: `${match.home_name} v ${match.away_name}`, match, appearances, embed: embedUrl(match.video_url) });
  });

  app.get("/players", (_req, res) =>
    res.render("players", { title: "Squad", players: playerRows(db, true) }));

  app.get("/players/:id", (req, res) => {
    const id = parseId(req.params.id);
    const player = id && (playerRows(db) as any[]).find((p) => p.id === id);
    if (!player) return res.status(404).render("error", { title: "Player not found", message: "That player does not exist." });
    const games = db.prepare(`
      SELECT m.*, a.team, a.goals, a.assists FROM appearances a
      JOIN matches m ON m.id=a.match_id WHERE a.player_id=? ORDER BY m.played_at DESC
    `).all(id);
    res.render("player", { title: player.name, player, games });
  });

  const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: "draft-8", legacyHeaders: false });
  app.get("/admin/login", (req, res) => {
    if (req.admin) return res.redirect("/admin");
    res.render("admin/login", { title: "Admin sign in", error: null });
  });
  app.post("/admin/login", loginLimiter, async (req, res) => {
    const input = z.object({ username: z.string().min(1).max(80), password: z.string().min(1).max(200) }).safeParse(req.body);
    const credentials = input.success ? input.data : null;
    const admin = credentials
      ? db.prepare("SELECT * FROM admins WHERE username=?").get(credentials.username) as any
      : null;
    if (!admin || !credentials || !(await argon2.verify(admin.password_hash, credentials.password))) {
      return res.status(401).render("admin/login", { title: "Admin sign in", error: "Incorrect username or password." });
    }
    createSession(db, admin.id, res);
    res.redirect("/admin");
  });
  app.post("/admin/logout", requireAdmin, requireCsrf, (req, res) => {
    destroySession(db, req, res);
    res.redirect("/");
  });

  app.use("/admin", requireAdmin);
  app.get("/admin", (_req, res) => res.render("admin/dashboard", {
    title: "Admin", matches: matchRows(db).slice(0, 6), players: playerRows(db),
    notice: typeof _req.query.saved === "string" ? "Changes saved." : null
  }));

  app.get("/admin/players/new", (_req, res) =>
    res.render("admin/player-form", { title: "Add player", player: null, errors: [] }));
  app.get("/admin/players/:id/edit", (req, res) => {
    const id = parseId(req.params.id);
    const player = id && db.prepare("SELECT * FROM players WHERE id=?").get(id);
    if (!player) return res.status(404).render("error", { title: "Player not found", message: "That player does not exist." });
    res.render("admin/player-form", { title: "Edit player", player, errors: [] });
  });
  app.post("/admin/players", requireCsrf, (req, res) => savePlayer(req, res));
  app.post("/admin/players/:id", requireCsrf, (req, res) => savePlayer(req, res, parseId(req.params.id)));

  function savePlayer(req: Request, res: Response, id?: number | null) {
    const parsed = playerSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).render("admin/player-form", {
      title: id ? "Edit player" : "Add player", player: { ...req.body, id }, errors: parsed.error.issues.map((e) => e.message)
    });
    const p = parsed.data;
    if (id) {
      db.prepare(`UPDATE players SET name=?,nickname=?,position=?,shirt_number=?,bio=?,photo_url=?,active=? WHERE id=?`)
        .run(p.name, p.nickname, p.position, p.shirt_number || null, p.bio, p.photo_url, p.active, id);
    } else {
      db.prepare(`INSERT INTO players (name,nickname,position,shirt_number,bio,photo_url,active) VALUES (?,?,?,?,?,?,?)`)
        .run(p.name, p.nickname, p.position, p.shirt_number || null, p.bio, p.photo_url, p.active);
    }
    res.redirect("/admin?saved=player");
  }

  app.get("/admin/matches/new", (_req, res) => res.render("admin/match-form", {
    title: "Add game", match: null, players: playerRows(db, true), errors: []
  }));
  app.get("/admin/matches/:id/edit", (req, res) => {
    const id = parseId(req.params.id);
    const match = id && db.prepare("SELECT * FROM matches WHERE id=?").get(id);
    if (!match) return res.status(404).render("error", { title: "Game not found", message: "That game does not exist." });
    res.render("admin/match-form", { title: "Edit game", match, players: playerRows(db, true), errors: [] });
  });
  app.post("/admin/matches", requireCsrf, (req, res) => saveMatch(req, res));
  app.post("/admin/matches/:id", requireCsrf, (req, res) => saveMatch(req, res, parseId(req.params.id)));

  function saveMatch(req: Request, res: Response, id?: number | null) {
    const parsed = matchSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).render("admin/match-form", {
      title: id ? "Edit game" : "Add game", match: { ...req.body, id },
      players: playerRows(db, true), errors: parsed.error.issues.map((e) => e.message)
    });
    const m = parsed.data;
    const values = [m.played_at, m.venue, m.home_name, m.away_name, m.home_score, m.away_score, m.score_known,
      m.status, m.report, m.video_url, m.potm_player_id || null];
    if (id) {
      db.prepare(`UPDATE matches SET played_at=?,venue=?,home_name=?,away_name=?,home_score=?,away_score=?,
        score_known=?,status=?,report=?,video_url=?,potm_player_id=? WHERE id=?`).run(...values, id);
      return res.redirect(`/admin/matches/${id}/stats`);
    }
    const result = db.prepare(`INSERT INTO matches
      (played_at,venue,home_name,away_name,home_score,away_score,score_known,status,report,video_url,potm_player_id)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`).run(...values);
    res.redirect(`/admin/matches/${result.lastInsertRowid}/stats`);
  }

  app.get("/admin/matches/:id/stats", (req, res) => {
    const id = parseId(req.params.id);
    const match = id && db.prepare("SELECT * FROM matches WHERE id=?").get(id);
    if (!match) return res.status(404).render("error", { title: "Game not found", message: "That game does not exist." });
    const stats = db.prepare("SELECT * FROM appearances WHERE match_id=?").all(id) as any[];
    const byPlayer = Object.fromEntries(stats.map((s) => [s.player_id, s]));
    res.render("admin/stats-form", { title: "Game stats", match, players: playerRows(db, true), byPlayer });
  });
  app.post("/admin/matches/:id/stats", requireCsrf, (req, res) => {
    const id = parseId(req.params.id);
    if (!id || !db.prepare("SELECT 1 FROM matches WHERE id=?").get(id)) {
      return res.status(404).render("error", { title: "Game not found", message: "That game does not exist." });
    }
    const players = playerRows(db, true) as any[];
    const save = db.transaction(() => {
      db.prepare("DELETE FROM appearances WHERE match_id=?").run(id);
      const add = db.prepare("INSERT INTO appearances VALUES (?,?,?,?,?)");
      for (const player of players) {
        const team = req.body[`team_${player.id}`];
        if (team !== "home" && team !== "away") continue;
        const goals = z.coerce.number().int().min(0).max(30).catch(0).parse(req.body[`goals_${player.id}`]);
        const assists = z.coerce.number().int().min(0).max(30).catch(0).parse(req.body[`assists_${player.id}`]);
        add.run(id, player.id, team, goals, assists);
      }
    });
    save();
    res.redirect("/admin?saved=stats");
  });

  app.use((_req, res) => res.status(404).render("error", { title: "Page not found", message: "We could not find that page." }));
  app.use((error: unknown, _req: Request, res: Response, _next: unknown) => {
    console.error(error);
    res.status(500).render("error", { title: "Something went wrong", message: "Please try again in a moment." });
  });
  return app;
}
