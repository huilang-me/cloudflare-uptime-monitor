// fetch.ts
import { parseConfig } from "../lib/config";
import { checkAllSites } from "./check";
import { handleAuth } from "../lib/auth";
import { renderHomePage } from "./home";
import { handleLogRequest } from "./log";

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
      return await handleLogRequest(request, env);
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
