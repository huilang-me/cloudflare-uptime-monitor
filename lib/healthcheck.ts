import { parseConfig } from "./config";

export async function runHealthCheck(env): Promise<Response> {
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

  // ⚠️ 构建建议项
  const suggestions = {};
  for (const check of checks) {
    if (check.ok) continue;

    switch (check.name) {
      case "MONITOR_CONFIG_JSON":
        suggestions.MONITOR_CONFIG_JSON =
          "请在 GitHub 仓库的 Settings > Secrets and variables > Actions > Variables 中设置 MONITOR_CONFIG_JSON，例如：[{\"name\":\"example\",\"url\":\"https://example.com\"}]";
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
    response["suggestions"] = suggestions;
  }

  return new Response(JSON.stringify(response, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}
