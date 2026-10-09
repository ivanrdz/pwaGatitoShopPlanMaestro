# Gatito Finanzas

PWA para administrar Gatito Shop: subes el reporte del lunes o del jueves y te dice cómo repartir el pago entre banco, inventario, publicidad, gastos fijos, sueldo y ahorro.

## Correr en local

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # pruebas del lector de reportes y de la lógica de dinero
npm run typecheck  # revisión de tipos
npm run build      # genera dist/
```

## Publicar en Vercel

Importa el repositorio en Vercel. Detecta Vite solo:
build `npm run build`, salida `dist`. No necesita reglas de reescritura porque la navegación usa `#/`.

Para instalarla en el celular: abre la URL en Chrome (Android) o Safari (iPhone) y elige "Agregar a pantalla de inicio".
En Android, una vez instalada, puedes **compartir el PDF desde WhatsApp directo a "Gatito"**.

## Primeros pasos

1. **Ajustes → Arranque:** elige la fecha desde la que llevas las cuentas y captura cómo estabas ese día (reserva, sobre de publicidad, deuda con el banco).
2. **Ajustes → Productos:** captura el inventario inicial de cada producto que compras por caja.
3. **Reportes:** sube tus PDF. Puedes subir varios a la vez; los de antes de la fecha de arranque se ven en el historial pero no mueven saldos.
4. Cada vez que compres cajas, regístralas en **Inventario**. Cada vez que Facebook te cobre, regístralo en **Inicio**.

## Cómo calcula cada pago

- **Corte del jueves:** cubre de lunes a miércoles (3 días). **Pago del lunes:** semana completa menos el corte del jueves (4 días). Si solo subes la semana completa, se toma como un pago de 7 días.
- **Banco:** piezas de caja entregadas × costo por pieza × (1 + premio), sin pasarse de la deuda pendiente. Si ya no hay deuda, ese costo va a "reponer inventario" dentro de la reserva.
- **Publicidad:** gasto diario × días del periodo.
- **Gastos fijos y sueldo:** monto mensual × días / 30.
- **Ahorro de Gatito:** lo que sobra. Si sale negativo, la diferencia viene de la reserva.

Los valores de publicidad, sueldo, gastos y premio se guardan con cada reporte al subirlo, así que cambiar los ajustes no reescribe tu historial. Puedes corregirlos por reporte en su detalle.

## Funciones

- **Indicadores** por semana con tendencia y comparación, y **Simulador** de escenarios (publicidad, entrega, sueldo, gastos fijos) basado en tu costo por pedido real.
- **Embudo de envíos** (Indicadores → Embudo): envíos a ruta → entregados → efectivo → utilidad, con motivos de no entrega; calculadora "si hago N envíos, ¿cuánto gano?" y "quiero ganar $X, ¿cuántos envíos necesito?" (con ajuste por anuncios más caros al escalar), escenarios de % de entrega y tabla semana por semana.
- La **guía de paquetería** se captura por caja y se reparte entre productos según sus cajas.
- **Punto de reorden inteligente:** pide cuando la venta diaria × (días que tarda tu proveedor + colchón) alcanza tu stock. Configura los días por producto en Ajustes.
- **Reemplazos por producto**, con resumen listo para copiar y mandar a tu proveedor.
- **Varias tiendas:** cada una con su propia base de datos (reportes, productos, banco, sobres). El lector detecta la tienda del reporte y no deja subirlo en la tienda equivocada.

## Privacidad y datos

- De cada reporte solo se guardan totales y piezas por producto. **No se guardan nombres, teléfonos ni direcciones de clientes.**
- Todo vive en IndexedDB en tu dispositivo. Descarga un respaldo de vez en cuando en **Ajustes → Respaldo**.

## Estructura

```
src/
  lib/parseReport.ts   Lector del texto del reporte (lógica pura, con pruebas)
  lib/finance.ts       Reparto de pagos, banco, sobres, reserva e inventario (lógica pura, con pruebas)
  lib/pdfText.ts       Extracción de texto con pdf.js (se carga solo al subir un PDF)
  lib/db.ts            IndexedDB
  state/AppData.tsx    Estado global y acciones
  lib/series.ts        Datos para gráficas, indicadores y reemplazos
  lib/simulador.ts     Simulador de escenarios (lógica pura, con pruebas)
  lib/embudo.ts        Embudo de envíos y calculadora (lógica pura, con pruebas)
  state/Tiendas.tsx    Varias tiendas, cada una en su propia IndexedDB
  components/          Billete (reparto), Gráficas (SVG sin dependencias), Cargador, Diálogo, Campos
  pages/               Inicio, Indicadores, Reportes, Inventario, Banco, Ajustes
public/
  sw.js                Service worker: offline y recepción de PDFs compartidos
  manifest.webmanifest
```

Si el reporte cambia de formato o aparece un producto nuevo, ajusta los patrones en **Ajustes → Productos** ("Cómo aparece en el reporte"). Son expresiones regulares que se comparan contra el texto en mayúsculas y sin acentos; el orden de los productos importa.
