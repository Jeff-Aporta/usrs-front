# Spec — layout común de usrs-front (WHAT)

Qué debe observar una persona que abre `/usrs/`. No describe cómo está hecho; los nombres de tags
aparecen solo porque "usar el layout común del kit" es el requisito.

Guardián: [`tests/layout.e2e.test.ts`](../../tests/layout.e2e.test.ts) (servidor local + API simulada).
Verificación en el VPS: `deno task verificar:vps` (mismos escenarios contra el despliegue real).

### S-U1 La app usa el layout común del kit

- La página monta `<iswc-app-shell>` del kit `iswc` cargado desde el CDN **fijado a un SHA**
  (nunca `@main` ni una rama).
- La barra superior muestra la marca "Usuarios", la navegación de secciones (`<iswc-app-nav>`,
  con la sección "Usuarios" activa) y la sesión (`<iswc-session-menu>`) a la derecha.
- La app no pinta una barra propia ni un login a pantalla completa.
- Al cargar, la consola no registra errores.

### S-U2 Sin sesión se inicia sesión desde la barra

- Sin sesión, la barra ofrece "Entrar" y la vista invita a usarlo; no se ven datos de usuarios.
- Desde el desplegable de "Entrar" se envían usuario y contraseña; la app los manda una sola vez a
  `POST /usrs/api/login`.
- Si el API rechaza, el error se ve en el desplegable y se sigue sin sesión.
- Si acepta, la sesión queda abierta sin recargar y la vista muestra la tabla de usuarios.
- La contraseña no queda guardada en el navegador (storage ni cookies).

### S-U3 Con sesión se ve el usuario y puede salir

- Con sesión, la barra muestra quién está conectado (nombre) en lugar de "Entrar".
- Al recargar la pestaña la sesión se conserva (misma pestaña).
- "Cerrar sesión" en el menú del usuario avisa al API (`DELETE /usrs/api/logout`), borra el token
  local y vuelve al estado sin sesión.
- Si el API responde 401 a una petición con sesión, la app vuelve al estado sin sesión.
