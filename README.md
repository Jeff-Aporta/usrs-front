# usrs-front

App de **Usuarios** (login + panel) 100% web components del kit `iswc`.

- Reusa `<iswc-login>`, `<iswc-card>`, `<iswc-button>`, `<iswc-callout>`, `<iswc-icon>`, `<iswc-tag>`, `<iswc-theme-toggle>`.
- Poppins global (`--iswc-font-sans`). Tarjetas con `--iswc-card-spacing` amplio.
- Estático: `index.html` + `src/app.css` + `src/usrs-app.js`. Lo sirve nginx en `/usrs/`; la API en `/usrs/api`.
- Sin paso de build: los módulos se sirven tal cual.
