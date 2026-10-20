// layout.e2e.test.ts — guardián WHAT de specs/layout/spec.md (S-U1…S-U3).
// Sirve el repo tal cual en /usrs/ (como nginx) con una API simulada en /usrs/api y lo
// recorre con Chrome del sistema. El kit se baja del CDN fijado a SHA, como en producción;
// los iconos (Iconify, externo y con límite de tasa) se sirven fijos para que sea determinista.
//
// Uso: deno task test
import assert from "node:assert/strict";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";
import {
  abrir, cerrarSesion, entrar, iniciarSesion, lanzar, menuUsuario, sinClaveGuardada, token,
  verificarAnonimo, verificarConSesion, verificarLayout,
} from "./_escenarios.ts";

const RAIZ = fileURLToPath(new URL("../", import.meta.url));
const TIPOS: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };
const USUARIO = { iusuario: "ana", nombre: "Ana María Pérez" };
const CLAVE = "clave-correcta-123";
const TOKEN = "tok-prueba-1";

/** Registro de lo que llega a la API simulada. */
const api: { method: string; path: string; body: unknown; auth: string | null }[] = [];
let forzar401 = false;

async function servir(req: Request): Promise<Response> {
  const url = new URL(req.url);
  if (url.pathname.startsWith("/usrs/api/")) {
    const path = url.pathname.slice("/usrs/api".length);
    const body = req.method === "POST" ? await req.json().catch(() => null) : null;
    const auth = req.headers.get("authorization");
    api.push({ method: req.method, path, body, auth });
    const json = (d: unknown, status = 200) => Response.json(d, { status });
    if (path === "/login" && req.method === "POST") {
      const b = body as { usuario?: string; password?: string } | null;
      return b?.usuario === USUARIO.iusuario && b?.password === CLAVE
        ? json({ token: TOKEN, usuario: USUARIO })
        : json({ error: "Credenciales inválidas" }, 401);
    }
    if (path === "/usuarios") {
      if (forzar401 || auth !== "Bearer " + TOKEN) return json({ error: "No autorizado" }, 401);
      return json([USUARIO, { iusuario: "luis", nombre: "Luis", bactivo: false }]);
    }
    if (path === "/logout" && req.method === "DELETE") return json({ ok: true });
    return json({ error: "no encontrado" }, 404);
  }
  if (!url.pathname.startsWith("/usrs/")) return new Response("no", { status: 404 });
  let rel = normalize(decodeURIComponent(url.pathname.slice("/usrs/".length)));
  if (!rel || rel === "." || rel.endsWith("/")) rel = join(rel, "index.html");
  if (rel.startsWith("..")) return new Response("no", { status: 403 });
  try {
    const data = await Deno.readFile(join(RAIZ, rel));
    return new Response(data, { headers: { "content-type": TIPOS[extname(rel)] ?? "application/octet-stream" } });
  } catch {
    const data = await Deno.readFile(join(RAIZ, "index.html")); // try_files → index.html, como nginx
    return new Response(data, { headers: { "content-type": TIPOS[".html"] } });
  }
}

Deno.test({ name: "usrs-front — layout común (specs/layout/spec.md)", sanitizeOps: false, sanitizeResources: false }, async (t) => {
  const server = Deno.serve({ port: 0, hostname: "127.0.0.1", onListen() {} }, servir);
  const BASE = `http://127.0.0.1:${server.addr.port}/usrs/`;
  const browser = await lanzar();
  try {
    await t.step("S-U1: la app usa el layout común del kit, fijado a SHA y sin errores", async () => {
      const s = await abrir(browser, BASE, { iconosLocales: true });
      try { await verificarLayout(s); } finally { await s.page.context().close(); }
    });

    await t.step("S-U2: sin sesión se ofrece Entrar en la barra y un rechazo se ve en el desplegable", async () => {
      const s = await abrir(browser, BASE, { iconosLocales: true });
      try {
        await verificarAnonimo(s.page);
        const desde = api.length;
        await iniciarSesion(s.page, "ana", "mala");
        await s.page.locator("iswc-session-menu iswc-login-dropdown").getByText("Credenciales inválidas").filter({ visible: true }).waitFor();
        assert.equal(api.slice(desde).filter((r) => r.path === "/login").length, 1, "un solo POST /login por envío");
        assert.equal(await token(s.page), null, "sigue sin sesión");
        assert.equal(await menuUsuario(s.page).count() > 0 && await menuUsuario(s.page).isVisible(), false);
      } finally { await s.page.context().close(); }
    });

    await t.step("S-U2: iniciar sesión desde la barra abre la sesión sin recargar y muestra los usuarios", async () => {
      const s = await abrir(browser, BASE, { iconosLocales: true });
      try {
        const desde = api.length;
        await iniciarSesion(s.page, "ana", CLAVE);
        await verificarConSesion(s.page, "Ana");
        const login = api.slice(desde).filter((r) => r.path === "/login");
        assert.equal(login.length, 1);
        assert.deepEqual(login[0]!.body, { usuario: "ana", password: CLAVE });
        assert.ok(api.slice(desde).some((r) => r.path === "/usuarios" && r.auth === "Bearer " + TOKEN), "los datos se piden con el token");
        await s.page.locator("usrs-app").getByRole("cell", { name: "Luis", exact: true }).waitFor();
        await sinClaveGuardada(s.page, CLAVE);
        assert.deepEqual(s.errores, [], "sin errores de consola");
      } finally { await s.page.context().close(); }
    });

    await t.step("S-U3: con sesión se ve el usuario, sobrevive a recargar y puede salir", async () => {
      const s = await abrir(browser, BASE, { iconosLocales: true });
      try {
        await iniciarSesion(s.page, "ana", CLAVE);
        await verificarConSesion(s.page, "Ana");
        await s.page.reload();
        await verificarConSesion(s.page, "Ana");
        await menuUsuario(s.page).click();
        await s.page.locator("iswc-session-menu").getByText("Ana María Pérez").filter({ visible: true }).waitFor();
        await s.page.keyboard.press("Escape");
        const desde = api.length;
        await cerrarSesion(s.page);
        assert.ok(api.slice(desde).some((r) => r.path === "/logout" && r.method === "DELETE"), "avisa al API");
        assert.equal(await token(s.page), null, "token local borrado");
        await verificarAnonimo(s.page);
        assert.deepEqual(s.errores, [], "sin errores de consola");
      } finally { await s.page.context().close(); }
    });

    await t.step("S-U3: un 401 del API devuelve al estado sin sesión", async () => {
      const s = await abrir(browser, BASE, { iconosLocales: true });
      try {
        await iniciarSesion(s.page, "ana", CLAVE);
        await verificarConSesion(s.page);
        forzar401 = true;
        await s.page.reload();
        await entrar(s.page).waitFor({ state: "visible" });
        assert.equal(await token(s.page), null);
      } finally { forzar401 = false; await s.page.context().close(); }
    });
  } finally {
    await browser.close();
    await server.shutdown();
  }
});
