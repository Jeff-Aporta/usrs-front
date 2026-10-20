/**
 * usrs-app — app de Usuarios sobre el layout común del kit iswc.
 *
 * El armazón (barra, navegación y sesión) vive en index.html con <iswc-app-shell>,
 * <iswc-app-nav> y <iswc-session-menu>. Este módulo solo:
 *   - carga los tags desde el CDN fijado a SHA,
 *   - autentica contra /usrs/api (el kit no hace fetch ni guarda tokens),
 *   - pinta la vista <usrs-app> (tabla de usuarios o invitación a entrar).
 */
import { iswcLoader as L } from "https://cdn.jsdelivr.net/gh/Jeff-Aporta/is-webcomponents@7ee7b872b431db52835da07d9ea189d7d64c2562/dist/cdn/core/loader.min.js";

const API = "/usrs/api";
const TAGS = [
  "iswc-app-shell", "iswc-app-nav", "iswc-session-menu", "iswc-theme-toggle",
  "iswc-card", "iswc-button", "iswc-callout", "iswc-icon", "iswc-tag",
];

const store = {
  get token() { return sessionStorage.getItem("usrs.token") || ""; },
  set token(v) { v ? sessionStorage.setItem("usrs.token", v) : sessionStorage.removeItem("usrs.token"); },
  get user() { try { return JSON.parse(sessionStorage.getItem("usrs.user") || "null"); } catch { return null; } },
  set user(v) { v ? sessionStorage.setItem("usrs.user", JSON.stringify(v)) : sessionStorage.removeItem("usrs.user"); },
  clear() { this.token = ""; this.user = null; },
};

async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = { "content-type": "application/json" };
  if (auth && store.token) headers.authorization = "Bearer " + store.token;
  const r = await fetch(API + path, { method, headers, ...(body ? { body: JSON.stringify(body) } : {}) });
  const text = await r.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) { const e = new Error(data?.error || data?.detail || r.statusText || ("HTTP " + r.status)); e.status = r.status; throw e; }
  return data;
}

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" }[c]));

const $ = (id) => document.getElementById(id);

/** Refleja la sesión guardada en el <iswc-session-menu> de la barra. */
function pintarSesion() {
  const sesion = $("sesion");
  if (!sesion) return;
  const u = store.user;
  if (store.token) {
    sesion.setAttribute("name", u?.nombre || u?.iusuario || "Usuario");
    if (u?.iusuario) sesion.setAttribute("subtitle", u.iusuario); else sesion.removeAttribute("subtitle");
    sesion.setAttribute("logged", "");
  } else {
    sesion.removeAttribute("logged");
    sesion.removeAttribute("name");
    sesion.removeAttribute("subtitle");
  }
}

const aviso = (message, color) => { try { $("shell")?.toast?.(message, { color }); } catch { /* sin toast no hay aviso */ } };

/** Vista: tabla de usuarios con sesión; invitación a entrar desde la barra sin ella. */
class UsrsApp extends HTMLElement {
  #users = [];
  #error = "";

  connectedCallback() {
    this.#render();
    if (store.token) this.load();
  }

  async load() {
    if (!store.token) { this.reset(); return; }
    try {
      const rows = await api("/usuarios");
      this.#users = Array.isArray(rows) ? rows : (rows?.rows ?? []);
      this.#error = "";
    } catch (e) {
      if (e.status === 401) { store.clear(); pintarSesion(); this.#users = []; this.#error = ""; }
      else this.#error = e.message;
    }
    this.#render();
  }

  reset() { this.#users = []; this.#error = ""; this.#render(); }

  #render() {
    if (!store.token) {
      this.innerHTML = `
        <section class="vista vista-anonima" data-estado="anonimo">
          <iswc-card>
            <span slot="header">Usuarios del ecosistema</span>
            <p class="invitacion"><iswc-icon icon="mdi:login"></iswc-icon> Inicia sesión con <strong>Entrar</strong>, en la barra superior, para ver el panel.</p>
          </iswc-card>
        </section>`;
      return;
    }
    const filas = this.#users.map((u) => `
      <tr>
        <td><iswc-icon icon="mdi:account-circle"></iswc-icon> ${esc(u.iusuario)}</td>
        <td>${esc(u.nombre ?? "—")}</td>
        <td>${u.bactivo === false ? '<iswc-tag color="warning">inactivo</iswc-tag>' : '<iswc-tag color="success">activo</iswc-tag>'}</td>
      </tr>`).join("");
    this.innerHTML = `
      <section class="vista" data-estado="sesion">
        <iswc-card>
          <span slot="header">Usuarios del sistema</span>
          <iswc-button slot="header-actions" id="refrescar" variant="text"><iswc-icon slot="start" icon="mdi:refresh"></iswc-icon> Refrescar</iswc-button>
          ${this.#error ? `<iswc-callout color="danger">${esc(this.#error)}</iswc-callout>` : ""}
          <div class="tabla-wrap">
            <table class="tabla">
              <thead><tr><th>Usuario</th><th>Nombre</th><th>Estado</th></tr></thead>
              <tbody>${filas || '<tr><td colspan="3" class="vacio">Sin usuarios</td></tr>'}</tbody>
            </table>
          </div>
        </iswc-card>
      </section>`;
    this.querySelector("#refrescar")?.addEventListener("iswc-click", () => this.load());
  }
}

customElements.define("usrs-app", UsrsApp);

const vista = () => document.querySelector("usrs-app");

/** Login desde el desplegable de la barra → /usrs/api/login. */
async function onLogin(ev) {
  const sesion = ev.currentTarget;
  const d = ev.detail || {};
  if (d.mode && d.mode !== "password") { sesion.error = "Modo de acceso no soportado"; return; }
  sesion.error = "";
  sesion.loading = true;
  try {
    const res = await api("/login", { method: "POST", body: { usuario: d.username, password: d.password }, auth: false });
    store.token = res.token;
    store.user = res.usuario;
    sesion.loading = false;
    pintarSesion();
    aviso("Sesión iniciada", "success");
    await vista()?.load();
  } catch (e) {
    sesion.error = e.status === 429 ? "Demasiados intentos fallidos. Espera unos minutos." : (e.message || "Credenciales inválidas");
  } finally {
    sesion.loading = false;
  }
}

/** Salir: invalida en el API (best effort) y limpia la sesión local. */
async function onLogout() {
  try { await api("/logout", { method: "DELETE" }); } catch { /* best effort: la sesión local se limpia igual */ }
  store.clear();
  pintarSesion();
  vista()?.reset();
  aviso("Sesión cerrada");
}

/**
 * Inserta <iswc-session-menu> en la barra ya definido y desconectado.
 * Workaround del kit @7ee7b872: cuando el <iswc-login> interno (del <iswc-login-dropdown>) se
 * actualiza ya conectado, su attributeChangedCallback pinta antes de connectedCallback y lanza
 * "Cannot set properties of undefined (setting 'textContent')". Se evita actualizando todo el
 * árbol (shadow incluido) fuera del documento con customElements.upgrade antes de insertarlo.
 */
function montarSesion() {
  if ($("sesion")) return;
  const sesion = document.createElement("iswc-session-menu");
  sesion.id = "sesion";
  sesion.slot = "actions";
  sesion.setAttribute("heading", "Accede al panel");
  for (let i = 0; i < 4; i++) customElements.upgrade(sesion); // cada nivel de shadow crea el siguiente
  const shell = $("shell");
  shell?.insertBefore(sesion, shell.querySelector('[slot="actions"]'));
}

function cablear() {
  montarSesion();
  pintarSesion();
  $("sesion")?.addEventListener("iswc-login-submit", onLogin);
  $("sesion")?.addEventListener("iswc-logout", onLogout);
  // La marca y la única sección llevan a la vista de usuarios (el shell no enruta).
  $("shell")?.addEventListener("iswc-brand-home", (e) => { e.preventDefault(); vista()?.load(); });
  $("nav")?.addEventListener("iswc-nav-select", () => vista()?.load());
}

try { await L.load(...TAGS); } catch (e) { console.warn("[usrs] carga de tags", e); }
cablear();
document.documentElement.setAttribute("data-app-ready", "");
