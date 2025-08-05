// functions/home.ts
import { parseConfig } from "../lib/config";

export async function renderHomePage(env): Promise<Response> {
  const config = parseConfig(env.MONITOR_CONFIG_JSON);

  let html = `
    <!DOCTYPE html>
    <html lang="zh">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>网站监控状态</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
            Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
          padding: 1rem;
          background: #f0f4f8;
          color: #333;
          margin: 0 auto;
          max-width: 1000px;
        }
        h1 {
          font-size: 1.8rem;
          font-weight: 700;
          margin-bottom: 1rem;
        }
        select#timeRangeSelect {
          padding: 0.4rem 0.6rem;
          font-size: 1rem;
          border-radius: 6px;
          border: 1.5px solid #cbd5e1;
          background-color: #fff;
          margin-bottom: 1.2rem;
          max-width: 100%;
        }
        select#timeRangeSelect:focus {
          outline: none;
          border-color: #2563eb;
        }
        .table-wrapper {
          overflow-x: auto;
        }
        table {
          width: 100%;
          min-width: 600px;
          border-collapse: separate;
          border-spacing: 0;
          background: #fff;
          border-radius: 8px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
        }
        thead tr {
          background-color: #e2e8f0;
        }
        th, td {
          padding: 0.75rem 1rem;
          text-align: left;
          font-size: 0.95rem;
          border-bottom: 1px solid #e2e8f0;
          vertical-align: middle;
        }
        tbody tr:hover {
          background-color: #f9fafb;
        }
        a {
          color: #2563eb;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
        .status-bar {
          display: flex;
          flex-wrap: wrap;
          gap: 3px;
        }
        .bar {
          width: 3.2%;
          min-width: 10px;
          height: 16px;
          border-radius: 3px;
          background-color: #d1d5db;
          cursor: pointer;
        }
        .bar.ok {
          background-color: #22c55e;
        }
        .bar.fail {
          background-color: #ef4444;
        }
        .bar:hover {
          outline: 1px solid #000;
        }

        .popup {
          position: fixed;
          top: 8%;
          left: 50%;
          transform: translateX(-50%);
          background: #fff;
          border-radius: 10px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
          padding: 1rem 1.2rem;
          z-index: 1000;
          max-height: 75vh;
          overflow-y: auto;
          width: 90vw;
          max-width: 600px;
        }
        .popup-close {
          text-align: right;
          margin-bottom: 1rem;
        }
        .popup-close button {
          background-color: #ef4444;
          color: white;
          border: none;
          border-radius: 4px;
          padding: 0.3rem 0.8rem;
          cursor: pointer;
          font-weight: 600;
        }
        .popup-close button:hover {
          background-color: #dc2626;
        }
        .overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.5);
          z-index: 999;
        }

        @media (max-width: 600px) {
          h1 {
            font-size: 1.5rem;
          }
          th, td {
            padding: 0.5rem 0.75rem;
            font-size: 0.9rem;
          }
          .bar {
            height: 14px;
            min-width: 8px;
          }
        }
      </style>
    </head>
    <body>
      <h1>📊 网站监控状态</h1>
      <label for="timeRangeSelect">选择时间范围：</label>
      <select id="timeRangeSelect">
        <option value="24">最近24小时</option>
        <option value="168">最近一周（7天）</option>
        <option value="336">最近两周（14天）</option>
        <option value="all">所有数据</option>
      </select>
      <div class="table-wrapper">
        <table>
          <thead>
            <tr>
              <th>网站</th>
              <th>状态变化（按小时）</th>
            </tr>
          </thead>
          <tbody>
  `;

  for (const site of config) {
    const safeId = site.name.replace(/[^a-zA-Z0-9]/g, "");
    html += `
      <tr>
        <td><a href="${site.url}" target="_blank">${site.name}</a></td>
        <td><div class="status-bar" id="bar-${safeId}">加载中...</div></td>
      </tr>
    `;
  }

  html += `
          </tbody>
        </table>
      </div>
      <div id="popup" class="popup" style="display:none;"></div>
      <div id="overlay" class="overlay" style="display:none;" onclick="closePopup()"></div>
      <script>
        const now = new Date();
        const nowTs = Math.floor(now.getTime() / 1000);
        const sites = ${JSON.stringify(config.map(site => site.name))};

        function getHourKeyFromTimestamp(ts) {
          const d = new Date(ts * 1000);
          d.setMinutes(0, 0, 0);
          return d.getFullYear() + '-' +
                 String(d.getMonth() + 1).padStart(2, '0') + '-' +
                 String(d.getDate()).padStart(2, '0') + ' ' +
                 String(d.getHours()).padStart(2, '0');
        }

        function showPopup(el) {
          const hour = el.getAttribute('data-hour');
          const siteName = el.getAttribute('data-siteName');
          const [datePart, hourPart] = hour.split(' ');
          const [year, month, day] = datePart.split('-').map(Number);
          const hourNum = Number(hourPart);
          const fromTs = Math.floor(new Date(year, month - 1, day, hourNum).getTime() / 1000);
          const toTs = fromTs + 3600;

          fetch('/log?name=' + encodeURIComponent(siteName) + '&from=' + fromTs + '&to=' + toTs)
            .then(res => res.json())
            .then(logs => {
              logs.sort((a, b) => a.timestamp - b.timestamp);
              let html = '<div class="popup-close"><button onclick="closePopup()">关闭</button></div>';
              html += '<h3>' + hour + ' - ' + siteName + ' 状态详情</h3>';
              html += '<div class="status-bar">';
              logs.forEach(log => {
                const cls = log.status === 'up' ? 'ok' : 'fail';
                const title = new Date(log.timestamp * 1000).toLocaleString();
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

        function getFromTimestamp(range) {
          if (range === 'all') {
            return 0;
          } else {
            return nowTs - parseInt(range, 10) * 3600;
          }
        }

        function renderStatusBars(timeRange) {
          sites.forEach(function(name) {
            const fromTs = getFromTimestamp(timeRange);
            const toTs = nowTs;

            fetch('/log?name=' + encodeURIComponent(name) + '&from=' + fromTs + '&to=' + toTs)
              .then(res => res.json())
              .then(logs => {
                const hourMap = {};
                logs.forEach(log => {
                  const key = getHourKeyFromTimestamp(log.timestamp);
                  if (!hourMap[key]) hourMap[key] = [];
                  hourMap[key].push(log.status);
                });

                let totalHours = 0;
                if (timeRange === 'all') {
                  if (logs.length === 0) {
                    totalHours = 24;
                  } else {
                    const timestamps = logs.map(l => l.timestamp);
                    const minTs = Math.min(...timestamps);
                    const maxTs = Math.max(...timestamps);
                    totalHours = Math.ceil((maxTs - minTs) / 3600);
                  }
                } else {
                  totalHours = parseInt(timeRange, 10);
                }

                totalHours = Math.min(totalHours, 30*24); // 最多显示30天

                const bars = [];
                for (let i = totalHours - 1; i >= 0; i--) {
                  const d = new Date((nowTs - i * 3600) * 1000);
                  d.setMinutes(0, 0, 0);
                  const key = getHourKeyFromTimestamp(Math.floor(d.getTime() / 1000));
                  const statuses = hourMap[key] || [];
                  const hasFail = statuses.some(s => s !== 'up');
                  const cls = statuses.length === 0 ? '' : hasFail ? 'fail' : 'ok';
                  const title = key + (statuses.length === 0 ? ': 无数据' : hasFail ? ': 异常' : ': 正常');
                  bars.push('<div class="bar ' + cls + '" title="' + title + '" data-hour="' + key + '" data-siteName="' + name + '" onclick="showPopup(this)"></div>');
                }

                const container = document.getElementById('bar-' + name.replace(/[^a-zA-Z0-9]/g, ""));
                container.innerHTML = bars.join('');
              });
          });
        }

        // 默认加载24小时
        renderStatusBars('24');

        document.getElementById('timeRangeSelect').addEventListener('change', e => {
          renderStatusBars(e.target.value);
        });
      </script>
    </body>
    </html>
  `;

  return new Response(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
