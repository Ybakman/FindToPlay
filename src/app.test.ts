import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { Db } from "./db.js";
import { createDatabase } from "./db.js";
import { createApp } from "./app.js";

let db: Db;
let app: Express;

beforeAll(async () => {
  process.env.ADMIN_USERNAME = "test-admin";
  process.env.ADMIN_PASSWORD = "a-strong-test-password";
  process.env.COOKIE_SECRET = "test-cookie-secret-long-enough";
  db = await createDatabase(":memory:");
  app = createApp(db);
});

afterAll(() => db.close());

describe("public website", () => {
  it("renders the home page with the next game and latest score", async () => {
    const response = await request(app).get("/");
    expect(response.status).toBe(200);
    expect(response.text).toContain("Our game.");
    expect(response.text).toContain("Thu, 19 Nov 2026");
    expect(response.text).toContain("Not recorded");
    expect(response.headers["content-security-policy"]).toBeTruthy();
  });

  it("renders the verified match record without inventing missing stats", async () => {
    const response = await request(app).get("/matches/1");
    expect(response.status).toBe(200);
    expect(response.text).toContain("Player stats");
    expect(response.text).toContain("score, team sheet and individual totals were not available");
    expect(response.text).toContain("https://webapp.sofive.com/event/1173037");
    expect(response.text).toContain("Stats will be added after the game");
  });

  it("returns a useful 404 page", async () => {
    const response = await request(app).get("/matches/9999");
    expect(response.status).toBe(404);
    expect(response.text).toContain("Game not found");
  });
});

describe("admin console", () => {
  it("redirects anonymous users away from the dashboard", async () => {
    const response = await request(app).get("/admin");
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe("/admin/login");
  });

  it("authenticates, enforces CSRF and saves a player", async () => {
    const agent = request.agent(app);
    const login = await agent.post("/admin/login").type("form").send({
      username: "test-admin", password: "a-strong-test-password"
    });
    expect(login.status).toBe(302);
    expect(login.headers.location).toBe("/admin");

    const forbidden = await agent.post("/admin/players").type("form").send({ name: "No CSRF" });
    expect(forbidden.status).toBe(403);

    const dashboard = await agent.get("/admin");
    const csrf = dashboard.text.match(/name="_csrf" value="([^"]+)"/)?.[1];
    expect(csrf).toBeTruthy();

    const saved = await agent.post("/admin/players").type("form").send({
      _csrf: csrf, name: "Taylor Green", nickname: "TG", position: "Defender",
      shirt_number: "12", bio: "Dependable defender.", photo_url: "", active: "1"
    });
    expect(saved.status).toBe(302);
    expect(db.prepare("SELECT name FROM players WHERE name=?").get("Taylor Green")).toEqual({ name: "Taylor Green" });

    const match = await agent.post("/admin/matches").type("form").send({
      _csrf: csrf, played_at: "2026-11-26T21:00", venue: "Venue pending",
      home_name: "Dark", away_name: "White", home_score: "0", away_score: "0",
      score_known: "0", status: "scheduled", report: "", video_url: "", potm_player_id: ""
    });
    expect(match.status).toBe(302);
    expect(db.prepare("SELECT score_known FROM matches WHERE played_at=?").get("2026-11-26T21:00"))
      .toEqual({ score_known: 0 });
  });
});
