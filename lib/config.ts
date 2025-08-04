export function parseConfig(raw: string | object): any[] {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new Error("MONITOR_CONFIG_JSON 字符串无法解析为 JSON");
    }
  }
  if (typeof raw === "object" && raw !== null) {
    return raw as any[];
  }
  throw new Error("MONITOR_CONFIG_JSON 不是有效的对象或字符串");
}
