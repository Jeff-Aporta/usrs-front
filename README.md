# usrs-front

App de **Usuarios** sobre el **layout común** del kit `iswc` (igual en todas las apps).

- Barra: `<iswc-app-shell brand="Usuarios">` + `<iswc-app-nav>` (secciones) + `<iswc-session-menu>`
  (slot `actions`). El login se hace desde el desplegable "Entrar" de la barra; no hay login a
  pantalla completa. El kit no autentica: la app llama a `/usrs/api/login` y `/usrs/api/logout`
  y guarda el token en `sessionStorage` (`usrs.token`, `usrs.user`), nunca la contraseña.
- Kit desde el CDN **fijado a SHA** (`import` en `src/usrs-app.js` y `data-icons` en `index.html`); nunca `@main`.
- Estático: `index.html` + `src/app.css` + `src/usrs-app.js`. Lo sirve nginx en `/usrs/`; la API en `/usrs/api`.
- Sin paso de build: los módulos se sirven tal cual.

## Spec y gate

- Contrato WHAT: [`specs/layout/spec.md`](specs/layout/spec.md).
- `deno task gate` — typecheck + lint + E2E con Chrome del sistema y API simulada.
- `deno task verificar:vps` — mismos escenarios contra `https://166.1.85.205:9443/usrs/`
  (login real solo si existen `E2E_USER`/`E2E_PASS`); capturas en `docs/`.

## Kit (@aebd1850) sin workarounds

- `<iswc-session-menu>` va declarado en `index.html` (slot `actions`): desde `aebd1850` el kit
  aplica los atributos puestos antes del registro, así que ya no se crea en JS ni se hace
  `customElements.upgrade` fuera del documento.
- El padding de `<iswc-card>` lo da el kit (`--iswc-space-*` definidos en `is-base`); la app no fija
  `--iswc-card-spacing`.
- Iconos: `<html data-icons="…is-webcomponents@<SHA>/assets/iconify/">` (mismo SHA que el loader).
  Todos los iconos de la app existen en esa carpeta (`mdi:account-group-outline`,
  `mdi:account-outline`, `mdi:login`, `mdi:refresh` + los internos del kit), por lo que la página no
  pide nada a `api.iconify.design` (sin 429). Si se añade un icono, comprobar que exista en
  `assets/iconify/<set>/` del kit al SHA fijado; si no, caería a la API con un aviso.
  Al subir el pin hay que cambiar el SHA en **dos** sitios: `src/usrs-app.js` e `index.html`.
