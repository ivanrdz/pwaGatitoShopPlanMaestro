import { afterEach, describe, expect, it } from 'vitest';
import { textoDeFlujo } from './pdfText';

const flujo = () =>
  new ReadableStream({
    start(c) {
      c.enqueue({
        items: [
          { str: 'TIENDA', hasEOL: false },
          { str: 'GATITOSHOP', hasEOL: true },
        ],
      });
      c.enqueue({ items: [{ type: 'beginMarkedContent' }, { str: 'EFECTIVO $11,722', hasEOL: true }] });
      c.close();
    },
  });

describe('textoDeFlujo', () => {
  const original = Object.getOwnPropertyDescriptor(ReadableStream.prototype, Symbol.asyncIterator);
  afterEach(() => {
    if (original) Object.defineProperty(ReadableStream.prototype, Symbol.asyncIterator, original);
  });

  it('junta el texto respetando los saltos de línea e ignora marcas sin texto', async () => {
    expect(await textoDeFlujo(flujo())).toBe('TIENDA GATITOSHOP\nEFECTIVO $11,722\n');
  });

  it('funciona aunque el navegador no permita recorrer el flujo con for await (Safari en iPhone)', async () => {
    // Simula Safari: ReadableStream sin Symbol.asyncIterator.
    delete (ReadableStream.prototype as unknown as Record<symbol, unknown>)[Symbol.asyncIterator];
    expect(Symbol.asyncIterator in ReadableStream.prototype).toBe(false);
    expect(await textoDeFlujo(flujo())).toContain('EFECTIVO $11,722');
  });
});
