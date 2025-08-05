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
          cursor: pointer;
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
        .popup {
          position: fixed;
          top: 10%;
          left: 50%;
          transform: translateX(-50%);
          background: #fff;
          border: 1px solid #ccc;
          box-shadow: 0 4px 10px rgba(0,0,0,0.2);
          padding: 1rem;
          z-index: 1000;
          max-height: 80vh;
          overflow-y: auto;
          min-width: 300px;
        }
        .popup-close {
          text-align: right;
          margin-bottom: 1rem;
        }
        .overlay {
          position: fixed;
          top: 0; left: 0;
          width: 100vw; height: 100vh;
          background: rgba(0, 0, 0, 0.5);
          z-index: 999;
        }
        .bar-row {
          margin: 0.5rem 0;
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
      <div id="popup" class="popup" style="display:none;"></div>
      <div id="overlay" class="overlay" style="display:none;" onclick="closePopup()"></div>
      <script>
        const now = new Date();
        const sites = ${JSON.stringify(config.map(site => site.name))};

        function getHourKey(dateStr) {
          const d = new Date(dateStr);
          d.setMinutes(0, 0, 0);
          return d.getFullYear() + '-' + (d.getMonth()+1).toString().padStart(2, '0') + '-' + d.getDate().toString().padStart(2, '0') + ' ' + d.getHours().toString().padStart(2, '0');
        }

        function showPopup(hour, siteName) {
          fetch('/log?name=' + encodeURIComponent(siteName) + '&limit=1000')
            .then(res => res.json())
            .then(logs => {
              const logsInHour = logs.filter(log => getHourKey(log.timestamp) === hour);
              let html = '<div class="popup-close"><button onclick="closePopup()">关闭</button></div>';
              html += '<h3>' + hour + ' - ' + siteName + ' 状态详情</h3>';
              html += '<div class="status-bar">';
              logsInHour.forEach(log => {
                const cls = log.status === 'up' ? 'ok' : 'fail';
                const title = new Date(log.timestamp).toLocaleString();
                html += '<div class="bar ' + cls + '" title="' + title + '"></div>';
              });
              html += '</div>';
              document.getElementById('popup').innerHTML = html;
              document.getElementById('popup').style.display = 'block';
              document.getElementById('overlay').style.display = 'block';
            });
        }

        function closePopup() {
          document.getElementById('popup').style.display = 'none';
          document.getElementById('overlay').style.display = 'none';
        }

        sites.forEach(function(name) {
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
                bars.push('<div class="bar ' + cls + '" title="' + title + '" onclick="showPopup(\\'' + key + '\\', \\' + name + '\\')"></div>');
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
