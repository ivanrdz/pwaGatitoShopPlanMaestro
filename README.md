# Gatito Finanzas

PWA para administrar Gatito Shop: subes el corte del lunes o del jueves y te dice cómo repartir el pago entre banco, inventario, publicidad, gastos fijos, sueldo y ahorro. Incluye indicadores, embudo de envíos, simulador, inventario con punto de reorden y varias tiendas.

**Stack:** React 19 · TypeScript estricto · Vite 6 · React Router 7 · Supabase (Auth + Postgres con RLS) · Workbox (vite-plugin-pwa) · Vitest + Testing Library · ESLint + Prettier · GitHub Actions.

## Arrancar

Requiere Node 20 o más reciente.

```bash
npm install
cp .env.example .env.local   # y llena tus llaves de Supabase (ver abajo)
npm run dev                  # http://localhost:5173
```

Sin `.env.local`, la app funciona igual pero guarda todo en el dispositivo (IndexedDB).

## Scripts

| Comando                           | Qué hace                                                       |
| --------------------------------- | -------------------------------------------------------------- |
| `npm run dev`                     | Servidor de desarrollo                                         |
| `npm run build`                   | Revisa tipos y genera `dist/` con el service worker            |
| `npm run preview`                 | Sirve el build para probarlo                                   |
| `npm run check`                   | Lint + tipos + formato + pruebas (lo mismo que el CI)          |
| `npm run lint` / `lint:fix`       | ESLint (cero advertencias permitidas)                          |
| `npm run format` / `format:check` | Prettier                                                       |
| `npm run typecheck`               | TypeScript de la app, del service worker y de la configuración |
| `npm test` / `test:watch`         | Pruebas                                                        |
| `npm run test:coverage`           | Pruebas con cobertura (reporte en `coverage/`)                 |

Al hacer commit, **Husky + lint-staged** corren ESLint y Prettier sobre los archivos cambiados. Si algo falla, el commit no pasa.

## Supabase

1. En tu proyecto de Supabase abre **SQL Editor**, pega el contenido de
   `supabase/migrations/20261009000000_esquema_inicial.sql` y ejecútalo. Crea las tablas con **Row Level Security**: cada usuario solo ve sus datos.
   (Con la CLI: `supabase link --project-ref TU_REF` y `supabase db push`.)
2. En **Authentication → URL Configuration** pon como _Site URL_ la dirección donde publiques la app (por ejemplo `https://gatito.vercel.app`) y agrega `http://localhost:5173` en _Redirect URLs_. Es a donde lleva el correo de confirmación.
3. Copia `.env.example` a `.env.local` y llena `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` (**Project Settings → Data API**). Usa solo la llave **anon**: es pública por diseño y la protege RLS. **Nunca** pongas la `service_role` en la app.
4. Abre la app, crea tu cuenta y confirma tu correo.
5. Si ya tenías datos en este dispositivo, en **Ajustes → Tu cuenta** aparece **Subir a la nube**.

`.env.local` no se sube a git. En las pruebas, `.env.test` deja Supabase apagado para que nunca toquen tu base real.

## Publicar en Vercel

Importa el repositorio en Vercel (detecta Vite solo) y agrega `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en **Settings → Environment Variables**. `vercel.json` ya trae las reescrituras para las rutas y los encabezados de caché del service worker.

Para instalarla en el celular: abre la URL en Chrome (Android) o Safari (iPhone) y elige "Agregar a pantalla de inicio". En Android, una vez instalada, puedes **compartir el PDF desde WhatsApp directo a "Gatito"**.

## Primeros pasos

La app arranca vacía: sin cortes, sin inventario, sin deuda y sin reserva. Tú la vas alimentando.

1. **Ajustes → Tu dinero:** elige la fecha de arranque y captura cómo estabas ese día (reserva, sobre de publicidad, deuda con el banco).
2. **Ajustes → Productos:** revisa costos y captura cuántas piezas tienes de cada producto.
3. **Reportes:** sube tus PDF de lunes y jueves. Puedes subir varios a la vez.
4. Cada vez que compres cajas, regístralas en **Inventario**. Cada vez que Facebook te cobre, regístralo en **Inicio**.

## Cómo calcula cada pago

- **Corte del jueves:** lunes a miércoles (3 días). **Pago del lunes:** semana completa menos el corte del jueves (4 días).
- **Banco:** piezas de caja entregadas × costo por pieza × (1 + premio), sin pasarse de la deuda.
- **Publicidad:** gasto diario × días. **Gastos fijos y sueldo:** mensual × días / 30.
- **Ahorro:** lo que sobra; si es negativo, sale de la reserva.

Los valores de publicidad, sueldo, gastos y premio se guardan con cada reporte, así que cambiar los ajustes no reescribe tu historial.

## Arquitectura

```
src/
  app/          Router (lazy por pantalla), layout, Error Boundary, pantallas de error y 404
  domain/       Lógica de negocio pura: tipos, reparto de pagos, series e indicadores
  data/         Repositorio de datos: interfaz + IndexedDB (dispositivo) + Supabase (nube)
  features/     Una carpeta por módulo: inicio, indicadores, reportes, inventario, banco, ajustes, tiendas, auth
  shared/       Componentes de UI reutilizables y utilidades de formato
  state/        Contextos (sesión, tiendas, datos); cada contexto separado de su provider
  sw.ts         Service worker (Workbox): precarga, navegación sin internet y "Compartir"
  test/         Configuración de pruebas, datos de prueba y Supabase en memoria
supabase/migrations/   Esquema SQL con RLS
```

Reglas que sigue el código:

- Las pantallas nunca hablan con IndexedDB ni con Supabase directamente: usan `useApp()`, que usa la interfaz `Repositorio`. Cambiar de almacenamiento no toca la UI.
- La lógica de dinero vive en `domain/` y en archivos `.ts` de cada módulo, sin React, para poder probarla aislada.
- Imports con alias `@/` (por ejemplo `@/domain/finance`).

## Pruebas

- **Lógica:** lector de reportes contra el formato real, reparto de pagos, banco, embudo, simulador, arranque en cero.
- **Datos:** el repositorio de dispositivo y el de Supabase pasan las **mismas pruebas de contrato** (IndexedDB simulado y Supabase en memoria).
- **Componentes:** Embudo y Diálogo con Testing Library.
- **Integración:** la app completa con router en memoria: navegación, Ajustes y página 404.

El CI exige cobertura mínima en `domain/`, `data/` y en la lógica de indicadores.

## Privacidad

De cada reporte solo se guardan totales y piezas por producto. **No se guardan nombres, teléfonos ni direcciones de clientes.**
