import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type * as PdfJs from 'pdfjs-dist';

let pdfjs: typeof PdfJs | null = null;

async function cargarPdfjs() {
  if (!pdfjs) {
    pdfjs = await import('pdfjs-dist');
    pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  }
  return pdfjs;
}

interface TrozoTexto {
  items: Array<{ str?: string; hasEOL?: boolean } | object>;
}

/**
 * Junta el texto de una página leyendo el flujo con getReader().
 * No usa page.getTextContent(): por dentro hace `for await` sobre un ReadableStream,
 * y Safari en iPhone no lo soporta ("undefined is not a function").
 */
export async function textoDeFlujo(flujo: ReadableStream<TrozoTexto>): Promise<string> {
  const lector = flujo.getReader();
  let texto = '';
  try {
    for (;;) {
      const { done, value } = await lector.read();
      if (done) break;
      for (const item of value.items) {
        if ('str' in item && typeof item.str === 'string') texto += item.str + (item.hasEOL ? '\n' : ' ');
      }
    }
  } finally {
    lector.releaseLock();
  }
  return texto;
}

/** Saca el texto de todas las páginas, respetando los saltos de línea del PDF. */
export async function textoDePdf(archivo: Blob): Promise<string> {
  const lib = await cargarPdfjs();
  const datos = new Uint8Array(await archivo.arrayBuffer());
  const doc = await lib.getDocument({ data: datos }).promise;
  let texto = '';
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const pagina = await doc.getPage(i);
      texto += (await textoDeFlujo(pagina.streamTextContent() as unknown as ReadableStream<TrozoTexto>)) + '\n';
    }
  } finally {
    await doc.destroy();
  }
  return texto;
}
