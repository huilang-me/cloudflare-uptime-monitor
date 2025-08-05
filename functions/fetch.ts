import { parseConfig } from "../lib/config";
import { checkAllSites } from "./check";
import { runHealthCheck } from "../lib/healthcheck";
import { handleAuth } from "../lib/auth";

export const onRequest = async (request: Request, env, ctx) => {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const redirectTarget = pathname + url.search;

    // 如果配置了用户名和密码，做全站登录保护
    if (env.USERNAME && env.PASSWORD) {
      const authResult = await handleAuth(request, env, redirectTarget);
      if (authResult) return authResult;
    }

    // 登录通过或者没有配置密码，执行各路由逻辑
    if (pathname === "/") {
      return await runHealthCheck(env);
    }

    if (pathname === "/logout") {
      return new Response("已登出", {
        status: 302,
        headers: {
          "Set-Cookie": "auth=; Path=/; Max-Age=0",
          "Location": "/",
          "Content-Type": "text/plain",
        },
      });
    }

    if (pathname === `/check`) {
      const results = await checkAllSites(env, "manual");
      return new Response(JSON.stringify(results, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // /log?name=xxx&limit=20
    if (pathname === `/log`) {
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

    // /info
    if (pathname === `/info`) {
      return new Response(JSON.stringify({
        config: parseConfig(env.MONITOR_CONFIG_JSON),
        telegram: {
          tokenExists: env.TELEGRAM_BOT_TOKEN,
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
