// /lib/auth.ts

export function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
}

function renderLoginPage(message = ""): Response {
  return new Response(`
    <!DOCTYPE html>
    <html lang="zh">
    <head>
      <meta charset="UTF-8" />
      <title>登录</title>
      <style>
        body {
          background-color: #f9fafb;
          font-family: Arial, sans-serif;
          display: flex;
          justify-content: center;
          align-items: center;
          height: 100vh;
        }
        .login-container {
          background: white;
          padding: 2rem 2.5rem;
          border-radius: 8px;
          box-shadow: 0 0 15px rgba(0,0,0,0.1);
          width: 100%;
          max-width: 400px;
        }
        h2 {
          margin-bottom: 1.5rem;
          text-align: center;
        }
        label {
          display: block;
          margin-bottom: 0.5rem;
          font-weight: bold;
        }
        input {
          width: 100%;
          padding: 0.5rem;
          margin-bottom: 1.25rem;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 1rem;
        }
        button {
          width: 100%;
          padding: 0.6rem;
          background-color: #2563eb;
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 1rem;
          cursor: pointer;
        }
        button:hover {
          background-color: #1d4ed8;
        }
        .error {
          color: red;
          margin-bottom: 1rem;
          text-align: center;
        }
      </style>
    </head>
    <body>
      <div class="login-container">
        <h2>登录验证</h2>
        ${message ? `<div class="error">${message}</div>` : ""}
        <form method="POST">
          <label for="username">用户名</label>
          <input type="text" id="username" name="username" required />
          <label for="password">密码</label>
          <input type="password" id="password" name="password" required />
          <button type="submit">登录</button>
        </form>
      </div>
    </body>
    </html>
  `, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

async function sign(value: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/=+$/, "");
}

async function verifySignature(value: string, signature: string, secret: string): Promise<boolean> {
  const expected = await sign(value, secret);
  return expected === signature;
}

export async function handleAuth(request: Request, env): Promise<Response | null> {
  const method = request.method;
  const cookie = getCookie(request, "auth");

  if (cookie) {
    const [username, timestamp, signature] = cookie.split(".");
    const value = `${username}.${timestamp}`;
    const valid = await verifySignature(value, signature, env.SESSION_SECRET);
    const expired = (Date.now() / 1000 - parseInt(timestamp)) > 3600;
    if (valid && !expired) return null;
  }

  if (method === "POST") {
    const contentType = request.headers.get("content-type") || "";
    if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const inputUsername = formData.get("username");
      const inputPassword = formData.get("password");

      if (inputUsername === env.USERNAME && inputPassword === env.PASSWORD) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const value = `${inputUsername}.${timestamp}`;
        const signature = await sign(value, env.SESSION_SECRET);
        const cookieValue = `${value}.${signature}`;
        return new Response(`<html><body>登录成功，<a href="/">点击进入首页</a></body></html>`, {
          headers: {
            "Set-Cookie": `auth=${cookieValue}; Path=/; HttpOnly; Max-Age=3600`,
            "Content-Type": "text/html; charset=utf-8",
          },
        });
      } else {
        return renderLoginPage("用户名或密码错误");
      }
    }
  }

  return renderLoginPage();
}
