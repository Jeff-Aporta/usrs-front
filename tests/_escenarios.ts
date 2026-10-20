// _escenarios.ts — pasos WHAT de specs/layout/spec.md, compartidos por el test local
// (API simulada) y la verificación contra el VPS. Solo afirman lo observable: lo que se
// ve en la barra, las peticiones que salen y lo que queda en el navegador.
import assert from "node:assert/strict";
import { chromium, type Browser, type Page } from "playwright-core";

export const CHROME = Deno.env.get("CHROME_PATH") ??
  ["C:/Program Files/Google/Chrome/Application/chrome.exe", "/usr/bin/google-chrome", "/usr/bin/chromium"]
    .find((p) => { try { return Deno.statSync(p).isFile; } catch { return false; } });

export function lanzar(): Promise<Browser> {
  if (!CHROME) throw new Error("No hay Chrome del sistema (define CHROME_PATH)");
  return chromium.launch({ executablePath: CHROME, headless: true });
}

export interface Peticion { method: string; url: string; postData: string | null }
export interface Sesion { page: Page; errores: string[]; peticiones: Peticion[] }

/** Iconos: servicio externo (api.iconify.design) que limita por tasa; no es comportamiento de la app. */
export const ICONOS = /^https:\/\/api\.iconify\.design\//;
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/></svg>';

/** Abre la app. `iconosLocales` sirve un SVG fijo en lugar de pedir los iconos a Iconify. */
export async function abrir(browser: Browser, url: string, { iconosLocales = false } = {}): Promise<Sesion> {
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true, viewport: { width: 1280, height: 800 } });
  if (iconosLocales) {
    await ctx.route(ICONOS, (r) => r.fulfill({ status: 200, contentType: "image/svg+xml", body: SVG, headers: { "access-control-allow-origin": "*" } }));
  }
  const page = await ctx.newPage();
  const errores: string[] = [];
  const peticiones: Peticion[] = [];
  page.on("console", (m) => { if (m.type() === "error") errores.push(m.text()); });
  page.on("pageerror", (e) => errores.push(String(e)));
  page.on("request", (r) => peticiones.push({ method: r.method(), url: r.url(), postData: r.postData() }));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await listo(page);
  return { page, errores, peticiones };
}

export async function listo(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document.documentElement.hasAttribute("data-app-ready") &&
    ["iswc-app-shell", "iswc-app-nav", "iswc-session-menu"].every((t) => !!customElements.get(t)), null, { timeout: 30_000 });
}

/** S-U1 — la app usa el layout común del kit, fijado a SHA. */
export async function verificarLayout({ page, peticiones, errores }: Sesion): Promise<void> {
  const kit = peticiones.filter((p) => p.url.includes("is-webcomponents"));
  assert.ok(kit.length > 0, "el kit se carga desde el CDN");
  for (const p of kit) assert.match(p.url, /is-webcomponents@[0-9a-f]{40}\//, "kit fijado a SHA: " + p.url);
  const shell = page.locator("iswc-app-shell");
  assert.equal(await shell.count(), 1, "un único app-shell");
  assert.equal((await shell.locator('[part="brand-text"]').textContent())?.trim(), "Usuarios", "marca Usuarios");
  const tab = page.locator("iswc-app-shell iswc-app-nav").getByRole("tab", { name: "Usuarios" });
  assert.equal(await tab.getAttribute("aria-selected"), "true", "sección Usuarios activa en la barra");
  const enBarra = await page.evaluate(() => {
    const s = document.querySelector("iswc-app-shell iswc-session-menu");
    const bar = document.querySelector("iswc-app-shell")!.shadowRoot!.querySelector('[part="bar"]')!.getBoundingClientRect();
    const r = s?.getBoundingClientRect();
    return !!r && r.top >= bar.top && r.bottom <= bar.bottom + 1 && r.left > bar.width / 2;
  });
  assert.ok(enBarra, "la sesión está a la derecha de la barra común");
  const propio = await page.evaluate(() => document.querySelectorAll("header, iswc-login").length);
  assert.equal(propio, 0, "sin barra propia ni login a pantalla completa");
  assert.deepEqual(errores, [], "sin errores de consola");
}

export const entrar = (page: Page) =>
  page.locator("iswc-session-menu").getByRole("button", { name: "Entrar", exact: true }).first();

/** S-U2 (parte anónima) — sin sesión se ofrece "Entrar" y no se ven datos. */
export async function verificarAnonimo(page: Page): Promise<void> {
  await entrar(page).waitFor({ state: "visible" });
  assert.equal(await page.locator("usrs-app table").count(), 0, "sin sesión no hay tabla");
  await page.locator("usrs-app").getByText("Entrar").waitFor();
}

export async function iniciarSesion(page: Page, usuario: string, clave: string): Promise<void> {
  await entrar(page).click();
  const login = page.locator("iswc-session-menu iswc-login-dropdown iswc-login");
  await login.locator("#username input").fill(usuario);
  await login.locator("#password input").fill(clave);
  await page.keyboard.press("Enter");
}

export const menuUsuario = (page: Page) =>
  page.locator("iswc-session-menu").getByRole("button", { name: /Sesión de/ });

/** S-U3 — con sesión la barra muestra al usuario y la vista los datos. */
export async function verificarConSesion(page: Page, nombre?: string): Promise<void> {
  await menuUsuario(page).waitFor({ state: "visible", timeout: 15_000 });
  if (nombre) assert.match((await menuUsuario(page).getAttribute("aria-label")) ?? "", new RegExp(nombre));
  assert.equal(await entrar(page).isVisible(), false, "con sesión no se ofrece Entrar");
  await page.locator("usrs-app table").waitFor({ state: "visible" });
}

export async function cerrarSesion(page: Page): Promise<void> {
  await menuUsuario(page).click();
  await page.locator("iswc-session-menu").getByText("Cerrar sesión").click();
  await entrar(page).waitFor({ state: "visible" });
}

/** La clave no debe quedar en storage ni cookies. */
export async function sinClaveGuardada(page: Page, clave: string): Promise<void> {
  const todo = await page.evaluate(() =>
    [localStorage, sessionStorage].flatMap((s) => Object.keys(s).map((k) => k + "=" + s.getItem(k))).join("\n") + document.cookie);
  assert.ok(!todo.includes(clave), "la contraseña no queda guardada en el navegador");
}

export const token = (page: Page) => page.evaluate(() => sessionStorage.getItem("usrs.token"));
