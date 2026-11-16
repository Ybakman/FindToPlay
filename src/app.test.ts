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
    expect(response.text).toContain("7–6");
    expect(response.headers["content-security-policy"]).toBeTruthy();
  });

  it("renders match stats and a privacy-enhanced video embed", async () => {
    const response = await request(app).get("/matches/1");
    expect(response.status).toBe(200);
    expect(response.text).toContain("Player stats");
    expect(response.text).toContain("youtube-nocookie.com/embed/");
    expect(response.text).toContain("Sam Patel");
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
  });
});
