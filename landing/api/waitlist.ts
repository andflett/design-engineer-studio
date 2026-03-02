import type { VercelRequest, VercelResponse } from "@vercel/node";
import { Redis } from "@upstash/redis";

function getRedis() {
  return new Redis({
    url: process.env.KV_REST_API_URL!,
    token: process.env.KV_REST_API_TOKEN!,
  });
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // GET = admin list (requires WAITLIST_SECRET)
  if (req.method === "GET") {
    const secret = req.headers["authorization"]?.replace("Bearer ", "");
    if (!process.env.WAITLIST_SECRET || secret !== process.env.WAITLIST_SECRET) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    try {
      const redis = getRedis();
      const entries = await redis.zrange<string[]>("waitlist", 0, -1);
      return res.status(200).json({ count: entries.length, emails: entries });
    } catch (err) {
      console.error("KV read failed:", err);
      return res.status(500).json({ error: "Failed to read waitlist" });
    }
  }

  // POST = submit email (public)
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { email } = req.body ?? {};

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return res.status(400).json({ error: "Valid email required" });
  }

  const normalised = email.trim().toLowerCase();

  try {
    const redis = getRedis();
    await redis.zadd("waitlist", { score: Date.now(), member: normalised });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("KV write failed:", err);
    // Fallback: log to Vercel function logs so you never lose a signup
    console.log("WAITLIST_SIGNUP:", normalised);
    return res.status(200).json({ ok: true });
  }
}
