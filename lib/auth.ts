// lib/auth.ts
import { runHealthCheck } from "./healthcheck";

function getCookie(request: Request, name: string): string | null {
  const cookie = request.headers.get("Cookie");
  if (!cookie) return null;
  const match = cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? match[1] : null;
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
  return btoa(String.fromCharCode(...new Uint8Array(sig)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

async function verifySignature(value: string, signature: string, secret: string): Promise<boolean> {
  const expected = await sign(value, secret);
  return expected === signature;
}

function renderLoginPage(message = ""): Response {
  const healthMsg = message
    ? `<pre style="color:red;white-space:pre-wrap;margin-bottom:1em;">${message}</pre>`
    : "";

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
        input[type="text"],
        input[type="password"] {
          width: 100%;
          padding: 0.5rem;
          margin-bottom: 1rem;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 1rem;
        }
        .checkbox-label {
          display: flex;
          align-items: center;
          margin-bottom: 1.25rem;
          font-weight: normal;
        }
        .checkbox-label input {
          margin-right: 0.5rem;
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
      </style>
    </head>
    <body>
      <div class="login-container">
        ${healthMsg}
        <h2>登录验证</h2>
        <form method="POST">
          <label for="username">用户名</label>
          <input type="text" id="username" name="username" required />
          <label for="password">密码</label>
          <input type="password" id="password" name="password" required />
          <label class="checkbox-label">
            <input type="checkbox" id="remember" name="remember" />
            记住我（7天免登录）
          </label>
          <button type="submit">登录</button>
        </form>
      </div>
    </body>
    </html>
  `, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function handleAuth(request: Request, env): Promise<Response | null> {
  const method = request.method;

  // 系统配置检查（如出错，显示提示）
  const healthCheckMsg = await runHealthCheck(env);
  if (healthCheckMsg) {
    return renderLoginPage(healthCheckMsg);
  }

  // 校验 Cookie
  const cookie = getCookie(request, "auth");
  if (cookie) {
    const [username, timestampStr, signature] = cookie.split(".");
    if (username && timestampStr && signature) {
      const value = `${username}.${timestampStr}`;
      const valid = await verifySignature(value, signature, env.SESSION_SECRET);
      const age = Date.now() / 1000 - parseInt(timestampStr, 10);
      const expired = age > 604800; // 最长 7 天有效
      if (valid && !expired) return null;
    }
  }

  // 登录处理
  if (method === "POST") {
    const formData = await request.formData();
    const inputUsername = formData.get("username");
    const inputPassword = formData.get("password");
    const rememberMe = formData.get("remember") === "on";
    const maxAge = rememberMe ? 604800 : 3600;

    if (inputUsername === env.USERNAME && inputPassword === env.PASSWORD) {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const value = `${inputUsername}.${timestamp}`;
      const signature = await sign(value, env.SESSION_SECRET);
      const cookieValue = `${value}.${signature}`;
      return new Response(null, {
        status: 302,
        headers: {
          "Set-Cookie": `auth=${cookieValue}; Path=/; HttpOnly; Max-Age=${maxAge}`,
          "Location": "/", // 登录成功跳转首页
        },
      });
    } else {
      return renderLoginPage("用户名或密码错误");
    }
  }

  // 初始显示登录页
  return renderLoginPage();
}
