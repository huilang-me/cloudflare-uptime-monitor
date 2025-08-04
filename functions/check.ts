import { parseConfig } from "../lib/config";
import { getBeijingTimeISOString } from "../lib/time";
import { sendTelegram } from "../lib/telegram";

export async function checkAllSites(env, source = "scheduled") {
  const config = parseConfig(env.MONITOR_CONFIG_JSON);
  const timestamp = getBeijingTimeISOString();
  const isScheduled = source === "scheduled";
  const results = [];
  const MAX_LOG_AGE_MS = 1000 * 60 * 60 * 24 * 7 * 5;

  for (const site of config) {
    const { name, url } = site;
    let status = "unknown";
    let headers = {};
    let statusCode = 0;

    try {
      const res = await fetch(url, { method: "GET" });
      statusCode = res.status;
      status = res.status === 200 ? "up" : "down";
      for (const [k, v] of res.headers.entries()) {
        headers[k] = v;
      }
    } catch {
      status = "down";
    }

    const last = await env.DB.prepare(
      "SELECT status FROM logs WHERE name = ? ORDER BY timestamp DESC LIMIT 1"
    ).bind(name).first();

    const lastStatus = last?.status || "unknown";
    if (status !== lastStatus) {
      const msg = status === "up"
        ? `✅ 网站恢复: ${name}`
        : `🔴 网站故障: ${name}`;
      await sendTelegram(env, msg);
    }

    await env.DB.prepare(
      "INSERT INTO logs (name, status, timestamp, scheduled) VALUES (?, ?, ?, ?)"
    ).bind(name, status, timestamp, isScheduled ? 1 : 0).run();

    results.push({ name, status, statusCode, headers });
  }

  const cutoff = new Date(Date.now() - MAX_LOG_AGE_MS).toISOString();
  await env.DB.prepare("DELETE FROM logs WHERE timestamp < ?").bind(cutoff).run();

  return results;
}
