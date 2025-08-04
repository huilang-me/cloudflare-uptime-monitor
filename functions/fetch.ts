import { parseConfig } from "../lib/config";
import { checkAllSites } from "./check";
import { runHealthCheck } from "../lib/healthcheck";

export const onRequest = async (request: Request, env, ctx) => {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname.slice(1);

    // 👉 自检 /
    if (pathname === "") {
      return await runHealthCheck(env);
    }

    // 👉 手动触发监控
    if (pathname === `${env.UUID}/check`) {
      const results = await checkAllSites(env, "manual");
      return new Response(JSON.stringify(results, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 👉 查看日志 /UUID/log?name=xxx&limit=20
    if (pathname === `${env.UUID}/log`) {
      const { searchParams } = url;
      const name = searchParams.get("name");
      const limit = parseInt(searchParams.get("limit") || "20");

      let query = "SELECT name, status, timestamp, scheduled, duration_ms FROM logs";
      const binds = [];

      if (name) {
        query += " WHERE name = ?";
        binds.push(name);
      }
      query += " ORDER BY timestamp DESC LIMIT ?";
      binds.push(limit);

      const logs = await env.DB.prepare(query).bind(...binds).all();

      return new Response(JSON.stringify(logs.results, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 👉 查看配置信息 /UUID/info
    if (pathname === `${env.UUID}/info`) {
      return new Response(JSON.stringify({
        uuid: env.UUID,
        config: parseConfig(env.MONITOR_CONFIG_JSON),
        telegram: {
          tokenExists: !!env.TELEGRAM_BOT_TOKEN,
          chatId: env.TELEGRAM_CHAT_ID,
        },
      }, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("请输入正确的参数访问", { status: 200 });
  } catch (e) {
    return new Response(`Worker error: ${e.message}`, { status: 500 });
  }
};
