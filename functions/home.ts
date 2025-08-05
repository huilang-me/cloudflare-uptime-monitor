// functions/home.ts
import { parseConfig } from "../lib/config";

function getHourKey(timestamp: string): string {
  const date = new Date(timestamp);
  date.setMinutes(0, 0, 0);
  return date.toISOString();
}

export async function renderHomePage(env): Promise<Response> {
  const config = parseConfig(env.MONITOR_CONFIG_JSON);
  const now = Date.now();
  const since = now - 24 * 60 * 60 * 1000; // 过去24小时

  let html = `
    <!DOCTYPE html>
    <html lang="zh">
    <head>
      <meta charset="UTF-8">
      <title>网站监控状态</title>
      <style>
        body {
          font-family: sans-serif;
          padding: 2rem;
          background: #f8fafc;
        }
        h1 {
          margin-bottom: 1.5rem;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          background: white;
          margin-bottom: 3rem;
        }
        th, td {
          padding: 0.75rem;
          border: 1px solid #e2e8f0;
          text-align: left;
        }
        th {
          background-color: #f1f5f9;
        }
        .status-bar {
          display: flex;
          gap: 2px;
        }
        .bar {
          width: 4%;
          height: 16px;
          border-radius: 2px;
          background-color: #ccc;
        }
        .bar.ok {
          background-color: #16a34a;
        }
        .bar.fail {
          background-color: #dc2626;
        }
        .bar:hover {
          outline: 1px solid #000;
        }
      </style>
    </head>
    <body>
      <h1>📊 网站监控状态</h1>
      <table>
        <thead>
          <tr>
            <th>网站</th>
            <th>最近24小时状态</th>
          </tr>
        </thead>
        <tbody>
  `;

  for (const site of config) {
    // 获取过去24小时的所有记录
    const result = await env.DB.prepare(
      `SELECT status, timestamp FROM logs WHERE name = ? AND timestamp >= ? ORDER BY timestamp ASC`
    ).bind(site.name, new Date(since).toISOString()).all();

    const hourlyMap = new Map<string, string[]>(); // key: hour ISO string, value: status[]

    for (const log of result.results) {
      const hour = getHourKey(log.timestamp);
      if (!hourlyMap.has(hour)) hourlyMap.set(hour, []);
      hourlyMap.get(hour)!.push(log.status);
    }

    // 构建最近24小时的24个小时块
    const bars: string[] = [];
    for (let i = 23; i >= 0; i--) {
      const hourDate = new Date(now - i * 60 * 60 * 1000);
      const hourKey = hourDate.toISOString().slice(0, 13) + ":00:00.000Z";
      const statuses = hourlyMap.get(hourKey) || [];
      const hasFailure = statuses.some(s => s !== "up");
      const statusClass = hasFailure ? "fail" : (statuses.length > 0 ? "ok" : ""); // 没数据显示灰色
      const title = `${hourDate.toLocaleString("zh-CN")}: ${statuses.length > 0 ? (hasFailure ? "异常" : "正常") : "无数据"}`;
      bars.push(`<div class="bar ${statusClass}" title="${title}"></div>`);
    }

    html += `
      <tr>
        <td><a href="${site.url}" target="_blank">${site.name}</a></td>
        <td><div class="status-bar">${bars.join("")}</div></td>
      </tr>
    `;
  }

  html += `
        </tbody>
      </table>
    </body>
    </html>
  `;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
