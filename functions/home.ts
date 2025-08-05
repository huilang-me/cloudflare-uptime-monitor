// functions/home.ts
import { parseConfig } from "../lib/config";

export async function renderHomePage(env): Promise<Response> {
  const config = parseConfig(env.MONITOR_CONFIG_JSON);

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
    // 获取最近24条记录（按小时算）
    const logs = await env.DB.prepare(
      `SELECT status, timestamp FROM logs WHERE name = ? ORDER BY timestamp DESC LIMIT 24`
    ).bind(site.name).all();

    const bars = logs.results
      .slice() // 防止修改原数组
      .reverse() // 时间正序显示
      .map(log => {
        const time = new Date(log.timestamp).toLocaleString("zh-CN");
        const cls = log.status === "ok" ? "ok" : "fail";
        return `<div class="bar ${cls}" title="${time}: ${log.status}"></div>`;
      }).join("");

    html += `
      <tr>
        <td><a href="${site.url}" target="_blank">${site.name}</a></td>
        <td><div class="status-bar">${bars}</div></td>
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
