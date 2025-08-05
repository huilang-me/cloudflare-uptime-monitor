// home.ts
import { parseConfig } from "../lib/config";

export async function renderHomePage(env): Promise<Response> {
  const config = parseConfig(env.MONITOR_CONFIG_JSON);

  let html = `
    <!DOCTYPE html>
    <html lang="zh">
    <head>
      <meta charset="UTF-8" />
      <title>网站监控状态</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
            Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
          padding: 2rem 3rem;
          background: #f0f4f8;
          color: #333;
          min-width: 360px;
        }
        h1 {
          margin-bottom: 1.2rem;
          font-weight: 700;
          font-size: 2rem;
          display: flex;
          align-items: center;
          gap: 0.6rem;
        }
        select#timeRangeSelect {
          margin-bottom: 1.5rem;
          padding: 0.4rem 0.6rem;
          font-size: 1rem;
          border-radius: 6px;
          border: 1.5px solid #cbd5e1;
          background-color: #fff;
          transition: border-color 0.3s ease;
          cursor: pointer;
          user-select: none;
        }
        select#timeRangeSelect:hover,
        select#timeRangeSelect:focus {
          border-color: #2563eb;
          outline: none;
          box-shadow: 0 0 8px rgba(37, 99, 235, 0.4);
        }
        table {
          width: 100%;
          border-collapse: separate;
          border-spacing: 0;
          border-radius: 8px;
          overflow: hidden;
          background: #fff;
          box-shadow: 0 2px 8px rgb(0 0 0 / 0.1);
        }
        thead tr {
          background-color: #e2e8f0;
        }
        th, td {
          padding: 0.8rem 1rem;
          text-align: left;
          font-weight: 500;
          border-bottom: 1px solid #e2e8f0;
          font-size: 0.95rem;
          vertical-align: middle;
          user-select: text;
        }
        tbody tr:hover {
          background-color: #f1f5f9;
        }
        a {
          color: #2563eb;
          text-decoration: none;
          transition: color 0.3s ease;
        }
        a:hover {
          color: #1d4ed8;
          text-decoration: underline;
        }
        .status-bar {
          display: flex;
          gap: 3px;
          flex-wrap: wrap;
          max-width: 100%;
          user-select: none;
        }
        .bar {
          width: 3.5%;
          min-width: 12px;
          height: 16px;
          border-radius: 3px;
          background-color: #d1d5db;
          cursor: pointer;
          transition: background-color 0.25s ease, transform 0.15s ease;
        }
        .bar.ok {
          background-color: #22c55e; /* 绿色 */
        }
        .bar.fail {
          background-color: #ef4444; /* 红色 */
        }
        .bar:hover {
          outline: 2px solid #111;
          transform: scale(1.15);
          z-index: 10;
          box-shadow: 0 0 5px rgba(0,0,0,0.2);
        }
        .popup {
          position: fixed;
          top: 10%;
          left: 50%;
          transform: translateX(-50%);
          background: #fff;
          border-radius: 10px;
          border: 1px solid #ccc;
          box-shadow: 0 8px 24px rgba(0,0,0,0.15);
          padding: 1.2rem 1.5rem;
          z-index: 1000;
          max-height: 75vh;
          overflow-y: auto;
          min-width: 320px;
          max-width: 90vw;
          font-size: 0.9rem;
          color: #222;
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
          transition: background-color 0.3s ease;
        }
        .popup-close button:hover {
          background-color: #dc2626;
        }
        .overlay {
          position: fixed;
          top: 0; left: 0;
          width: 100vw; height: 100vh;
          background: rgba(0, 0, 0, 0.45);
          z-index: 999;
        }
        h3 {
          margin-top: 0;
          margin-bottom: 0.8rem;
          font-weight: 700;
          font-size: 1.2rem;
          color: #111827;
        }
      </style>
    </head>
    <body>
      <h1>📊 网站监控状态</h1>
      <label for="timeRangeSelect" style="font-weight:600; margin-bottom: 0.4rem; display:block;">
        选择时间范围：
      </label>
      <select id="timeRangeSelect" aria-label="选择时间范围">
        <option value="24">最近24小时</option>
        <option value="168">最近一周（7天）</option>
        <option value="336">最近两周（14天）</option>
        <option value="all">所有数据</option>
      </select>
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
    html += `
      <tr>
        <td><a href="${site.url}" target="_blank" rel="noopener noreferrer">${site.name}</a></td>
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
        const nowTs = Math.floor(now.getTime() / 1000); // 当前秒级时间戳
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
          const hour = el.getAttribute('data-hour'); // 格式是 "YYYY-MM-DD HH"
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
                totalHours = Math.min(totalHours, 336); // 最多显示14天

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

        // 页面加载默认展示最近24小时
        renderStatusBars('24');

        // 监听时间选择变化
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
