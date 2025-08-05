import { parseConfig } from "./config";

export async function runHealthCheck(env): Promise<string> {
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

  // 3. USERNAME
  checks.push({
    name: "USERNAME",
    ok: typeof env.USERNAME === "string" && env.USERNAME.length > 0,
    details: env.USERNAME ? "存在" : "未设置",
  });

  // 4. PASSWORD
  checks.push({
    name: "PASSWORD",
    ok: typeof env.PASSWORD === "string" && env.PASSWORD.length > 0,
    details: env.PASSWORD ? "存在" : "未设置",
  });

  // 5. TELEGRAM
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

  // 收集所有不通过的检查，准备提示文本
  const failedChecks = checks.filter(c => !c.ok);

  if (failedChecks.length === 0) return ""; // 全部通过，返回空字符串

  let msg = "配置检查未通过，请注意以下项：\n";
  for (const check of failedChecks) {
    msg += `- ${check.name}: ${check.details}\n`;
  }

  return msg;
}
