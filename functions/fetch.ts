// functions/fetch.ts
import { parseConfig } from "../lib/config";
import { checkAllSites } from "./check";
import { handleAuth } from "../lib/auth";
import { renderHomePage } from "./home";

export const onRequest = async (request: Request, env, ctx) => {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const redirectTarget = pathname + url.search;

    // 登录认证（全站）
    if (env.USERNAME && env.PASSWORD) {
      const authResult = await handleAuth(request, env, redirectTarget);
      if (authResult) return authResult;
    }

    // 首页渲染监控概览
    if (pathname === "/") {
      return await renderHomePage(env);
    }

    // 登出
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

    // 手动监控触发
    if (pathname === `/check`) {
      const results = await checkAllSites(env, "manual");
      return new Response(JSON.stringify(results, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    // 日志查看
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

    // 配置信息
    if (pathname === `/info`) {
      return new Response(JSON.stringify({
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
