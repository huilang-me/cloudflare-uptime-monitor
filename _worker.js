export default {
  async scheduled(controller, env, ctx) {
    try {
      await checkAllSites(env, "scheduled");
    } catch (e) {
      console.error("Scheduled task error:", e);
    }
  },

  async fetch(req, env, ctx) {
    try {
      const url = new URL(req.url);
      const pathname = url.pathname.slice(1);

      // 👉 配置自检 /
      if (pathname === "") {
        const checks = [];

        // 1. 检查 MONITOR_CONFIG_JSON
        let configCheck = { name: "MONITOR_CONFIG_JSON", ok: false };
        try {
          const config = parseConfig(env.MONITOR_CONFIG_JSON);
          if (Array.isArray(config)) {
            configCheck.ok = true;
            configCheck.details = `共 ${config.length} 个网站`;
          } else {
            configCheck.details = "不是数组结构";
          }
        } catch (e) {
          configCheck.details = `解析失败: ${e.message}`;
        }
        checks.push(configCheck);

        // 2. 检查 DB 是否能连接
        let dbCheck = { name: "DB", ok: false };
        try {
          const result = await env.DB.prepare("SELECT 1").first();
          dbCheck.ok = !!result;
          dbCheck.details = "连接成功";
        } catch (e) {
          dbCheck.details = `连接失败: ${e.message}`;
        }
        checks.push(dbCheck);

        // 3. UUID
        checks.push({
          name: "UUID",
          ok: typeof env.UUID === "string" && env.UUID.length > 0,
          details: env.UUID ? "存在" : "未设置",
        });

        // 4. TELEGRAM
        checks.push({
          name: "TELEGRAM_BOT_TOKEN",
          ok: !!env.TELEGRAM_BOT_TOKEN,
          details: env.TELEGRAM_BOT_TOKEN ? "存在" : "未设置",
        });
        checks.push({
          name: "TELEGRAM_CHAT_ID",
          ok: !!env.TELEGRAM_CHAT_ID,
          details: env.TELEGRAM_CHAT_ID ? "存在" : "未设置",
        });

        // ⚠️ 仅当存在失败项时，添加提示
        const suggestions = {};
        for (const check of checks) {
          if (check.ok) continue;

          switch (check.name) {
            case "MONITOR_CONFIG_JSON":
              suggestions.MONITOR_CONFIG_JSON =
                "请在 GitHub 仓库的 Settings > Secrets and variables > Actions > Variables 中设置 MONITOR_CONFIG_JSON，例如：[{\"name\":\"huilang\",\"url\":\"https://huilang.me\"}]";
              break;
            case "DB":
              suggestions.DB =
                "请确认你在 wrangler.toml 中绑定了 D1 数据库，例如：[[d1_databases]] binding = \"DB\" database_name = \"your-db\"";
              break;
            case "UUID":
              suggestions.UUID =
                "请在 GitHub 仓库的 Actions 环境变量中设置 UUID，例如随机字符串: e2cf3c1d-xxxx-xxxx-xxxx-xxxxxxxxxxxx";
              break;
            case "TELEGRAM_BOT_TOKEN":
              suggestions.TELEGRAM_BOT_TOKEN =
                "请在 GitHub Secrets 中设置 TELEGRAM_BOT_TOKEN，值为你的 Telegram Bot Token";
              break;
            case "TELEGRAM_CHAT_ID":
              suggestions.TELEGRAM_CHAT_ID =
                "请在 GitHub Secrets 中设置 TELEGRAM_CHAT_ID，值为你的 Telegram chat ID";
              break;
          }
        }

        const response = { status: "Config Check", checks };
        if (Object.keys(suggestions).length > 0) {
          response.suggestions = suggestions;
        }

        return new Response(JSON.stringify(response, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      }


      // 👉 手动触发监控
      if (pathname === env.UUID) {
        const results = await checkAllSites(env, "manual");
        return new Response(JSON.stringify(results, null, 2), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // 👉 查看日志 /UUID/log?name=x&limit=20
      if (pathname === `${env.UUID}/log`) {
        const { searchParams } = url;
        const name = searchParams.get("name");
        const limit = parseInt(searchParams.get("limit") || "20");

        let query = "SELECT name, status, timestamp, scheduled FROM logs";
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

      // 返回所有环境变量（env 对象）
      if (pathname === `${env.UUID}/info`) {
        return new Response(JSON.stringify({
          uuid: env.UUID,
          config: parseConfig(env.MONITOR_CONFIG_JSON),
          telegram: {
            tokenExists: !!env.TELEGRAM_BOT_TOKEN,
            chatId: env.TELEGRAM_CHAT_ID
          }
        }, null, 2), {
          headers: { 'Content-Type': 'application/json' }
        });
      }

      return new Response("请输入正确的参数访问", { status: 200 });
    } catch (e) {
      return new Response(`Worker error: ${e.message}`, { status: 500 });
    }
  },
};

async function checkAllSites(env, source = "scheduled") {
  const raw = env.MONITOR_CONFIG_JSON;
  const config = parseConfig(raw);

  // const config = parseConfig(env.MONITOR_CONFIG_JSON);
  const timestamp = getBeijingTimeISOString();
  const isScheduled = source === "scheduled";
  const results = [];
  const MAX_LOG_AGE_MS = 1000 * 60 * 60 * 24 * 7 * 5; // 5 weeks

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
    } catch (e) {
      status = "down";
    }

    const last = await env.DB.prepare(
      "SELECT status FROM logs WHERE name = ? ORDER BY timestamp DESC LIMIT 1"
    )
      .bind(name)
      .first();

    const lastStatus = last?.status || "unknown";
    if (status !== lastStatus) {
      const msg =
        status === "up"
          ? `✅ 网站恢复: ${name}`
          : `🔴 网站故障: ${name}`;
      await sendTelegram(env, msg);
    }

    await env.DB.prepare(
      "INSERT INTO logs (name, status, timestamp, scheduled) VALUES (?, ?, ?, ?)"
    )
      .bind(name, status, timestamp, isScheduled ? 1 : 0)
      .run();

    results.push({ name, status, statusCode, headers });
  }

  const cutoff = new Date(Date.now() - MAX_LOG_AGE_MS).toISOString();
  await env.DB.prepare("DELETE FROM logs WHERE timestamp < ?").bind(cutoff).run();

  return results;
}

function parseConfig(raw) {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new Error("MONITOR_CONFIG_JSON 字符串无法解析为 JSON");
    }
  }
  if (typeof raw === "object" && raw !== null) {
    return raw;
  }
  throw new Error("MONITOR_CONFIG_JSON 不是有效的对象或字符串");
}

function getBeijingTimeISOString() {
  const now = new Date();
  now.setUTCHours(now.getUTCHours() + 8); // 转为 UTC+8
  return now.toISOString().replace("T", " ").replace("Z", "");
}

async function sendTelegram(env, message) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    });
  } catch (e) {
    console.error("Telegram send error:", e);
  }
}
