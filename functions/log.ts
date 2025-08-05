// functions/log.ts
export async function handleLogRequest(request: Request, env): Promise<Response> {
  const url = new URL(request.url);
  const { searchParams } = url;

  const name = searchParams.get("name");
  const time = searchParams.get("time"); // 这里time的格式需要是小时的时间戳起点，或我们转换一下？
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

  if (time) {
    // 假设 time 是某小时的起始时间戳（秒），查询该小时内数据
    // timestamp >= time AND timestamp < time + 3600
    const timeNum = parseInt(time);
    if (!isNaN(timeNum)) {
      conditions.push("timestamp >= ? AND timestamp < ?");
      binds.push(timeNum, timeNum + 3600);
    }
  } else if (fromStr && toStr) {
    const from = parseInt(fromStr);
    const to = parseInt(toStr);
    if (!isNaN(from) && !isNaN(to)) {
      conditions.push("timestamp >= ? AND timestamp <= ?");
      binds.push(from, to);
    }
  } else if (!name && !time && !fromStr && !toStr) {
    // 没传任何参数，默认查最近1小时所有网站
    const now = Math.floor(Date.now() / 1000); // 当前秒级时间戳
    const oneHourAgo = now - 3600;
    conditions.push("timestamp >= ?");
    binds.push(oneHourAgo);
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
