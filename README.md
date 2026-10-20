# usrs-front

App de **Usuarios** sobre el **layout común** del kit `iswc` (igual en todas las apps).

- Barra: `<iswc-app-shell brand="Usuarios">` + `<iswc-app-nav>` (secciones) + `<iswc-session-menu>`
  (slot `actions`). El login se hace desde el desplegable "Entrar" de la barra; no hay login a
  pantalla completa. El kit no autentica: la app llama a `/usrs/api/login` y `/usrs/api/logout`
  y guarda el token en `sessionStorage` (`usrs.token`, `usrs.user`), nunca la contraseña.
- Kit desde el CDN **fijado a SHA** (constante del `import` en `src/usrs-app.js`); nunca `@main`.
- Estático: `index.html` + `src/app.css` + `src/usrs-app.js`. Lo sirve nginx en `/usrs/`; la API en `/usrs/api`.
- Sin paso de build: los módulos se sirven tal cual.

## Spec y gate

- Contrato WHAT: [`specs/layout/spec.md`](specs/layout/spec.md).
- `deno task gate` — typecheck + lint + E2E con Chrome del sistema y API simulada.
- `deno task verificar:vps` — mismos escenarios contra `https://166.1.85.205:9443/usrs/`
  (login real solo si existen `E2E_USER`/`E2E_PASS`); capturas en `docs/`.

## Workaround del kit (@7ee7b872)

`<iswc-session-menu>` no va en el HTML estático: `src/usrs-app.js` lo crea y lo actualiza fuera del
documento (`customElements.upgrade`) antes de insertarlo. Si el tag se actualiza ya conectado, el
`<iswc-login>` interno pinta en `attributeChangedCallback` antes de `connectedCallback` y lanza
`TypeError: Cannot set properties of undefined (setting 'textContent')`. Quitar cuando el kit lo corrija.
