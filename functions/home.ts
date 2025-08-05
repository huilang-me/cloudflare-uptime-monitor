// functions/home.ts
import { parseConfig } from "../lib/config";

export async function renderHomePage(env): Promise<Response> {
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
          background: #f9fafb;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          background: white;
        }
        th, td {
          padding: 0.75rem;
          border: 1px solid #ddd;
          text-align: left;
        }
        th {
          background-color: #f0f0f0;
        }
        .ok {
          color: green;
        }
        .fail {
          color: red;
        }
      </style>
    </head>
    <body>
      <h1>📊 网站监控状态</h1>
      <table>
        <thead>
          <tr>
            <th>名称</th>
            <th>地址</th>
            <th>状态</th>
            <th>最近检测时间</th>
          </tr>
        </thead>
        <tbody>
  `;

  try {
    const config = parseConfig(env.MONITOR_CONFIG_JSON);
    for (const site of config) {
      const latest = await env.DB.prepare(
        "SELECT status, timestamp FROM logs WHERE name = ? ORDER BY timestamp DESC LIMIT 1"
      ).bind(site.name).first();

      html += `
        <tr>
          <td>${site.name}</td>
          <td><a href="${site.url}" target="_blank">${site.url}</a></td>
          <td class="${latest?.status === 'ok' ? "ok" : "fail"}">${latest?.status || "未知"}</td>
          <td>${latest?.timestamp || "无记录"}</td>
        </tr>
      `;
    }
  } catch (e) {
    html += `<tr><td colspan="4">配置错误: ${e.message}</td></tr>`;
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
