const TOKEN_RE = /^[a-f0-9]{32}$/;
const encoder = new TextEncoder();

async function sha256(value) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
}
function response(request, env, data, status = 200) {
  const origin = request.headers.get("Origin") || "";
  const allowed = env.ALLOWED_ORIGIN || "*";
  const originAllowed = allowed === "*" || origin === allowed;
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
  if (originAllowed) headers["Access-Control-Allow-Origin"] = allowed === "*" ? "*" : origin;
  return new Response(JSON.stringify(data), { status, headers });
}
async function readBody(request) {
  try { return await request.json(); } catch { return null; }
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return response(request, env, { ok: true });
    const url = new URL(request.url);
    if (request.method !== "POST" || !["/create", "/validate"].includes(url.pathname)) {
      return response(request, env, { ok: false, message: "Not found" }, 404);
    }
    if (!env.KOAX_FLOWS) return response(request, env, { ok: false, message: "KV binding KOAX_FLOWS is missing" }, 500);
    const body = await readBody(request);
    const flow = body?.flow;
    const hwid = body?.hwid;
    if (typeof flow !== "string" || !TOKEN_RE.test(flow) || typeof hwid !== "string" || hwid.length < 16 || hwid.length > 128) {
      return response(request, env, { ok: false, message: "Invalid flow or browser ID" }, 400);
    }
    const key = `flow:${flow}`;
    const browserHash = await sha256(hwid);
    const now = Date.now();

    if (url.pathname === "/create") {
      const current = await env.KOAX_FLOWS.get(key, { type: "json" });
      if (current) {
        if (current.expiresAt > now && current.browserHash === browserHash && !current.used) {
          return response(request, env, { ok: true, reused: true });
        }
        return response(request, env, { ok: false, message: "Link đã được đăng ký, đã dùng hoặc hết hạn. Hãy tạo link mới." }, 409);
      }
      await env.KOAX_FLOWS.put(key, JSON.stringify({ browserHash, createdAt: now, expiresAt: now + 10 * 60 * 1000, used: false }), { expirationTtl: 600 });
      return response(request, env, { ok: true, expiresInSeconds: 600 });
    }

    const current = await env.KOAX_FLOWS.get(key, { type: "json" });
    if (!current || current.expiresAt <= now || current.browserHash !== browserHash || current.used) {
      return response(request, env, { ok: false, message: "Link không hợp lệ, sai trình duyệt, đã dùng hoặc hết hạn." }, 403);
    }
    current.used = true;
    current.usedAt = now;
    await env.KOAX_FLOWS.put(key, JSON.stringify(current), { expirationTtl: Math.max(60, Math.ceil((current.expiresAt - now) / 1000)) });
    return response(request, env, { ok: true, used: true });
  }
};
