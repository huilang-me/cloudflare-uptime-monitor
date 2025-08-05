// fetch.ts
import { parseConfig } from "../lib/config";
import { checkAllSites } from "./check";
import { handleAuth } from "../lib/auth";
import { renderHomePage } from "./home";

export const onRequest = async (request: Request, env, ctx) => {
  try {
    const url = new URL(request.url);
    const pathname = url.pathname;
    const redirectTarget = pathname + url.search;

    if (env.USERNAME && env.PASSWORD) {
      const authResult = await handleAuth(request, env, redirectTarget);
      if (authResult) return authResult;
    }

    if (pathname === "/") {
      return await renderHomePage(env);
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

    if (pathname === "/check") {
      const results = await checkAllSites(env, "manual");
      return new Response(JSON.stringify(results, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (pathname === "/log") {
      const { searchParams } = url;
      const name = searchParams.get("name");
      const time = searchParams.get("time");
      const from = searchParams.get("from");
      const to = searchParams.get("to");
      const limit = parseInt(searchParams.get("limit") || "0");
    
      let query = `
        SELECT name, status, timestamp, scheduled, duration_ms 
        FROM logs`;
      const binds = [];
      const conditions = [];
    
      if (name) {
        conditions.push("name = ?");
        binds.push(name);
      }
    
      if (time) {
        // 查询某小时
        conditions.push("strftime('%Y-%m-%d %H', timestamp, 'localtime') = ?");
        binds.push(time);
      } else if (from && to) {
        // 查询时间区间
        conditions.push("timestamp >= ? AND timestamp <= ?");
        binds.push(from, to);
      } else if (!name && !time && !from && !to) {
        // 没传任何参数，默认查最近1小时所有网站
        const now = new Date();
        const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
        conditions.push("timestamp >= datetime(?, 'localtime')");
        binds.push(oneHourAgo.toISOString());
      }
    
      if (conditions.length > 0) {
        query += " WHERE " + conditions.join(" AND ");
      }
    
      query += " ORDER BY timestamp ASC";
    
      if (limit > 0) {
        query += " LIMIT ?";
        binds.push(limit);
      }
    
      const logs = await env.DB.prepare(query).bind(...binds).all();
    
      return new Response(JSON.stringify(logs.results, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (pathname === "/info") {
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
