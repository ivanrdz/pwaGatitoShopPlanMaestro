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

/** Saca el texto de todas las páginas, respetando los saltos de línea del PDF. */
export async function textoDePdf(archivo: Blob): Promise<string> {
  const lib = await cargarPdfjs();
  const datos = new Uint8Array(await archivo.arrayBuffer());
  const doc = await lib.getDocument({ data: datos }).promise;
  let texto = '';
  try {
    for (let i = 1; i <= doc.numPages; i++) {
      const pagina = await doc.getPage(i);
      const contenido = await pagina.getTextContent();
      for (const item of contenido.items) {
        if ('str' in item) texto += item.str + (item.hasEOL ? '\n' : ' ');
      }
      texto += '\n';
    }
  } finally {
    await doc.destroy();
  }
  return texto;
}
