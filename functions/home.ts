// home.ts
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
    html += `
      <tr>
        <td><a href="${site.url}" target="_blank">${site.name}</a></td>
        <td><div class="status-bar" id="bar-${site.name.replace(/[^a-zA-Z0-9]/g, "")}">加载中...</div></td>
      </tr>
    `;
  }

  html += `
        </tbody>
      </table>

      <script>
        const now = new Date();
        const start = new Date(now.getTime() - 24 * 60 * 60 * 1000);

        const sites = ${JSON.stringify(config.map(site => site.name))};

        function formatHour(dateStr) {
          const d = new Date(dateStr);
          d.setMinutes(0, 0, 0);
          return d.toLocaleString('zh-CN', { hour: '2-digit', hour12: false });
        }

        function getHourKey(dateStr) {
          const d = new Date(dateStr);
          d.setMinutes(0, 0, 0);
          return d.getFullYear() + '-' + (d.getMonth()+1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0') + ' ' + d.getHours().toString().padStart(2, '0') + ':00';
        }

        sites.forEach(name => {
          fetch('/log?name=' + encodeURIComponent(name) + '&limit=500')
            .then(res => res.json())
            .then(logs => {
              const hourMap = {};
              logs.forEach(log => {
                const key = getHourKey(log.timestamp);
                if (!hourMap[key]) hourMap[key] = [];
                hourMap[key].push(log.status);
              });

              const bars = [];
              for (let i = 23; i >= 0; i--) {
                const d = new Date(now.getTime() - i * 60 * 60 * 1000);
                d.setMinutes(0, 0, 0);
                const key = getHourKey(d.toISOString());
                const statuses = hourMap[key] || [];
                const hasFail = statuses.some(s => s !== 'up');
                const cls = statuses.length === 0 ? '' : hasFail ? 'fail' : 'ok';
                const title = key + (statuses.length === 0 ? ': 无数据' : hasFail ? ': 异常' : ': 正常');
                bars.push('<div class="bar ' + cls + '" title="' + title + '"></div>');
              }

              const container = document.getElementById('bar-' + name.replace(/[^a-zA-Z0-9]/g, ""));
              container.innerHTML = bars.join('');
            });
        });
      </script>
    </body>
    </html>
  `;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
