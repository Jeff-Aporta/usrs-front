/**
 * usrs-app — app de Usuarios (login + panel) 100% web components del kit iswc.
 * Reusa <iswc-login>, <iswc-card>, <iswc-button>, <iswc-callout>, <iswc-icon>, <iswc-tag>.
 */
const API = "/usrs/api";
const TAGS = ["iswc-login","iswc-card","iswc-button","iswc-callout","iswc-icon","iswc-tag","iswc-theme-toggle","iswc-toast","iswc-spinner"];

const store = {
  get token() { return sessionStorage.getItem("usrs.token") || ""; },
  set token(v) { v ? sessionStorage.setItem("usrs.token", v) : sessionStorage.removeItem("usrs.token"); },
  get user() { try { return JSON.parse(sessionStorage.getItem("usrs.user") || "null"); } catch { return null; } },
  set user(v) { v ? sessionStorage.setItem("usrs.user", JSON.stringify(v)) : sessionStorage.removeItem("usrs.user"); },
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

class UsrsApp extends HTMLElement {
  #users = [];
  #error = "";
  #busy = false;

  connectedCallback() {
    this.#render();
    document.documentElement.setAttribute("data-app-ready", "");
    if (store.token) this.#loadUsers();
  }

  async #login(username, password) {
    this.#busy = true; this.#error = ""; this.#render();
    try {
      const res = await api("/login", { method: "POST", body: { usuario: username, password }, auth: false });
      store.token = res.token; store.user = res.usuario;
      await this.#loadUsers();
    } catch (e) {
      this.#error = e.status === 429 ? "Demasiados intentos fallidos. Espera unos minutos." : (e.message || "Credenciales inválidas");
    } finally { this.#busy = false; this.#render(); }
  }

  async #logout() {
    try { await api("/logout", { method: "DELETE" }); } catch {}
    store.token = ""; store.user = null; this.#users = []; this.#error = ""; this.#render();
  }

  async #loadUsers() {
    try { const rows = await api("/usuarios"); this.#users = Array.isArray(rows) ? rows : (rows?.rows ?? []); }
    catch (e) { if (e.status === 401) { store.token = ""; store.user = null; } this.#error = e.message; }
    this.#render();
  }

  #render() {
    const user = store.user;
    if (!store.token) {
      this.innerHTML = `
        <div class="shell login-shell">
          <div class="login-wrap">
            <iswc-login id="login" heading="Usuarios" subtitle="Accede al panel" provider="usrs" show-password ${this.#busy ? "busy" : ""} ${this.#error ? 'error="' + esc(this.#error) + '"' : ""}></iswc-login>
            ${this.#error ? `<iswc-callout color="danger">${esc(this.#error)}</iswc-callout>` : ""}
          </div>
        </div>`;
      this.querySelector("#login")?.addEventListener("iswc-login-submit", (ev) => {
        const d = ev.detail || {};
        this.#login(d.username, d.password);
      });
      return;
    }

    const filas = this.#users.map((u) => `
      <tr>
        <td><iswc-icon icon="mdi:account-circle"></iswc-icon> ${esc(u.iusuario)}</td>
        <td>${esc(u.nombre ?? "—")}</td>
        <td>${u.bactivo === false ? '<iswc-tag color="warning">inactivo</iswc-tag>' : '<iswc-tag color="success">activo</iswc-tag>'}</td>
      </tr>`).join("");

    this.innerHTML = `
      <div class="shell">
        <header class="barra">
          <strong class="marca">Usuarios</strong>
          <div class="acciones">
            <span class="usuario"><iswc-icon icon="mdi:account-circle"></iswc-icon> ${esc(user?.nombre || user?.iusuario || "—")}</span>
            <iswc-button id="refrescar" variant="text"><iswc-icon slot="start" icon="mdi:refresh"></iswc-icon> Refrescar</iswc-button>
            <iswc-button id="salir" variant="text"><iswc-icon slot="start" icon="mdi:logout"></iswc-icon> Salir</iswc-button>
            <iswc-theme-toggle scope="root"></iswc-theme-toggle>
          </div>
        </header>
        <main class="vista">
          <iswc-card>
            <span slot="header">Usuarios del sistema</span>
            ${this.#error ? `<iswc-callout color="danger">${esc(this.#error)}</iswc-callout>` : ""}
            <div class="tabla-wrap">
              <table class="tabla">
                <thead><tr><th>Usuario</th><th>Nombre</th><th>Estado</th></tr></thead>
                <tbody>${filas || '<tr><td colspan="3" class="vacio">Sin usuarios</td></tr>'}</tbody>
              </table>
            </div>
          </iswc-card>
        </main>
      </div>`;

    this.querySelector("#salir")?.addEventListener("iswc-click", () => this.#logout());
    this.querySelector("#refrescar")?.addEventListener("iswc-click", () => this.#loadUsers());
  }
}

customElements.define("usrs-app", UsrsApp);

(async () => {
  const L = globalThis.iswcLoader;
  if (!L) { document.documentElement.setAttribute("data-app-ready", ""); return; }
  try { await L.load(...TAGS); } catch (e) { console.warn("[usrs] carga de tags", e); }
  document.documentElement.setAttribute("data-app-ready", "");
})();
