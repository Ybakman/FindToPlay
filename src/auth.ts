import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";
import type { Db } from "./db.js";

const COOKIE = "football_session";
const TTL = 1000 * 60 * 60 * 12;

declare global {
  namespace Express {
    interface Request {
      admin?: { id: number; username: string };
      csrfToken?: string;
    }
  }
}

export function sessionMiddleware(db: Db) {
  const getSession = db.prepare(`
    SELECT a.id, a.username, s.csrf_token FROM sessions s
    JOIN admins a ON a.id=s.admin_id WHERE s.id=? AND s.expires_at>?
  `);
  return (req: Request, res: Response, next: NextFunction) => {
    const sid = req.signedCookies?.[COOKIE];
    if (sid) {
      const row = getSession.get(sid, Date.now()) as
        | { id: number; username: string; csrf_token: string }
        | undefined;
      if (row) {
        req.admin = { id: row.id, username: row.username };
        req.csrfToken = row.csrf_token;
      }
    }
    res.locals.admin = req.admin;
    res.locals.csrfToken = req.csrfToken;
    next();
  };
}

export function createSession(db: Db, adminId: number, res: Response) {
  const id = crypto.randomBytes(32).toString("base64url");
  const csrf = crypto.randomBytes(24).toString("base64url");
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(Date.now());
  db.prepare("INSERT INTO sessions VALUES (?,?,?,?)").run(id, adminId, csrf, Date.now() + TTL);
  res.cookie(COOKIE, id, {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: TTL
  });
}

export function destroySession(db: Db, req: Request, res: Response) {
  const sid = req.signedCookies?.[COOKIE];
  if (sid) db.prepare("DELETE FROM sessions WHERE id=?").run(sid);
  res.clearCookie(COOKIE);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.admin) return res.redirect("/admin/login");
  next();
}

export function requireCsrf(req: Request, res: Response, next: NextFunction) {
  if (!req.admin || !req.csrfToken || req.body?._csrf !== req.csrfToken) {
    return res.status(403).render("error", {
      title: "Request expired",
      message: "Please go back, refresh the page and try again."
    });
  }
  next();
}
