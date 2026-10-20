// verificar-vps.ts — recorre specs/layout/spec.md contra el despliegue real con Chrome del sistema.
// Sin E2E_USER/E2E_PASS solo verifica el estado anónimo (S-U1 y la parte anónima de S-U2).
// Guarda capturas en docs/. Las credenciales solo se leen del entorno; nunca se imprimen.
//
// Uso: deno task verificar:vps   (USRS_URL=https://166.1.85.205:9443/usrs/ por defecto)
import { fileURLToPath } from "node:url";
import {
  abrir, cerrarSesion, entrar, ICONOS, iniciarSesion, lanzar, sinClaveGuardada, token,
  verificarAnonimo, verificarConSesion, verificarLayout,
} from "./_escenarios.ts";

const URL_APP = Deno.env.get("USRS_URL") ?? "https://166.1.85.205:9443/usrs/";
const DOCS = fileURLToPath(new URL("../docs/", import.meta.url));
const USER = Deno.env.get("E2E_USER");
const PASS = Deno.env.get("E2E_PASS");

const browser = await lanzar();
let ok = true;
const paso = async (nombre: string, fn: () => Promise<void>) => {
  try { await fn(); console.log("✓ " + nombre); }
  catch (e) { ok = false; console.log("✗ " + nombre + "\n  " + String((e as Error).message ?? e).split("\n").slice(0, 6).join("\n  ")); }
};

try {
  const s = await abrir(browser, URL_APP);
  // Iconify (externo) puede limitar por tasa: se informa aparte, no es un error de la app.
  const iconos = () => s.errores.filter((e) => /iconify|ERR_FAILED/.test(e));
  const propios = () => s.errores.filter((e) => !/iconify|ERR_FAILED/.test(e));
  await s.page.waitForTimeout(1500);
  await paso("S-U1 layout común del kit fijado a SHA, sin errores de consola de la app", async () => {
    const copia = { ...s, errores: propios() };
    await verificarLayout(copia);
  });
  await paso("S-U2 sin sesión se ofrece Entrar en la barra", () => verificarAnonimo(s.page));
  await s.page.screenshot({ path: DOCS + "vps-anonimo.png" });
  await entrar(s.page).click();
  await s.page.locator("iswc-session-menu iswc-login-dropdown iswc-login #username input").waitFor({ state: "visible" });
  await s.page.waitForTimeout(400);
  await s.page.screenshot({ path: DOCS + "vps-login-desplegable.png" });
  await s.page.keyboard.press("Escape");

  // Rechazo real del API (usuario inexistente aleatorio): el error llega al desplegable.
  await paso("S-U2 un rechazo real de /usrs/api/login se ve en el desplegable y sigue sin sesión", async () => {
    const antes = s.errores.length;
    const respuesta = s.page.waitForResponse((r) => r.url().includes("/usrs/api/login"));
    await iniciarSesion(s.page, "e2e-inexistente-" + crypto.randomUUID().slice(0, 8), "x".repeat(12));
    const resp = await respuesta;
    const msg = String((await resp.json().catch(() => ({})))?.error ?? "");
    if (!msg) throw new Error("el API no devolvió mensaje de error");
    await s.page.locator("iswc-session-menu iswc-login-dropdown").getByText(msg).filter({ visible: true }).first().waitFor();
    await s.page.screenshot({ path: DOCS + "vps-login-rechazo.png" });
    if (await token(s.page)) throw new Error("no debería haber token");
    console.log("  POST /usrs/api/login → " + resp.status() + " «" + msg + "» visible en el desplegable");
    s.errores.splice(antes); // el 401 esperado se registra en consola como recurso fallido
    await s.page.keyboard.press("Escape");
  });

  if (USER && PASS) {
    await paso("S-U2 login desde el desplegable abre la sesión", async () => {
      await iniciarSesion(s.page, USER, PASS);
      await verificarConSesion(s.page);
      await sinClaveGuardada(s.page, PASS);
    });
    await s.page.screenshot({ path: DOCS + "vps-sesion.png" });
    await paso("S-U3 cerrar sesión vuelve a Entrar y borra el token", async () => {
      await cerrarSesion(s.page);
      if (await token(s.page)) throw new Error("el token sigue guardado");
    });
  } else {
    console.log("· sin E2E_USER/E2E_PASS: login real no verificado (solo estado anónimo)");
  }
  const kit = [...new Set(s.peticiones.map((p) => p.url).filter((u) => u.includes("is-webcomponents")).map((u) => u.match(/@([0-9a-f]{40}|[^/]+)\//)?.[1]))];
  console.log("· SHA del kit cargado: " + kit.join(", "));
  console.log("· errores de consola de la app: " + propios().length + (propios().length ? "\n  " + propios().join("\n  ") : ""));
  console.log("· errores externos de iconos (" + ICONOS.source + "): " + iconos().length);
  await s.page.context().close();
} finally {
  await browser.close();
}
if (!ok) Deno.exit(1);
