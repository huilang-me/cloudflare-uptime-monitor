// functions/log.ts
export async function handleLogRequest(request: Request, env): Promise<Response> {
  const url = new URL(request.url);
  const { searchParams } = url;

  const name = searchParams.get("name");
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");
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

  if (fromStr && toStr) {
    const from = parseInt(fromStr);
    const to = parseInt(toStr);
    if (!isNaN(from) && !isNaN(to)) {
      conditions.push("timestamp >= ? AND timestamp <= ?");
      binds.push(from, to);
    }
  } else if (!name && !fromStr && !toStr) {
    // 没传任何参数，默认查最近1小时所有网站
    const now = Math.floor(Date.now() / 1000); // 当前秒级时间戳
    const oneHourAgo = now - 3600;
    conditions.push("timestamp >= ?");
    binds.push(oneHourAgo);
  }

  if (conditions.length > 0) {
    query += " WHERE " + conditions.join(" AND ");
  }

  query += " ORDER BY timestamp DESC";

  if (limit > 0) {
    query += " LIMIT ?";
    binds.push(limit);
  }

  const logs = await env.DB.prepare(query).bind(...binds).all();

  return new Response(JSON.stringify(logs.results, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}
