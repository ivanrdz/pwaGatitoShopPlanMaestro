import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Bandeja } from '@/data/bandeja';
import { CargadorCtx, type Cargador } from './cargador';
import { AvisoConBandeja } from './BandejaAviso';

const archivos = [
  { ruta: 'u/1-07.10-GATITOSHOP.pdf', nombre: '07.10-GATITOSHOP.pdf', creado: '' },
  { ruta: 'u/2-10.10-GATITOSHOP.pdf', nombre: '10.10-GATITOSHOP.pdf', creado: '' },
];

function bandejaFalsa(lista = archivos): Bandeja & { borrar: ReturnType<typeof vi.fn> } {
  return {
    listar: vi.fn(async () => lista),
    descargar: vi.fn(async (a) => new File(['%PDF'], a.nombre, { type: 'application/pdf' })),
    borrar: vi.fn(async () => undefined),
  };
}

describe('<AvisoConBandeja />', () => {
  it('avisa cuántos reportes llegaron y los manda al revisor', async () => {
    const bandeja = bandejaFalsa();
    const procesar = vi.fn<Cargador['procesar']>(async () => undefined);
    render(
      <CargadorCtx.Provider value={{ elegirArchivos: () => undefined, procesar }}>
        <AvisoConBandeja bandeja={bandeja} />
      </CargadorCtx.Provider>,
    );
    expect(await screen.findByText(/Llegaron 2 reportes por correo/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Revisar y guardar' }));
    await waitFor(() => expect(procesar).toHaveBeenCalled());
    const [files, opciones] = procesar.mock.calls[0];
    expect(files.map((f) => f.name)).toEqual(['07.10-GATITOSHOP.pdf', '10.10-GATITOSHOP.pdf']);

    // Al guardar solo uno (el otro era de otra tienda), solo ese se borra.
    await opciones!.alGuardar!(['10.10-GATITOSHOP.pdf']);
    expect(bandeja.borrar).toHaveBeenCalledWith(['u/2-10.10-GATITOSHOP.pdf']);
  });

  it('sin reportes no muestra nada', async () => {
    const bandeja = bandejaFalsa([]);
    const { container } = render(
      <CargadorCtx.Provider value={{ elegirArchivos: () => undefined, procesar: async () => undefined }}>
        <AvisoConBandeja bandeja={bandeja} />
      </CargadorCtx.Provider>,
    );
    await waitFor(() => expect(bandeja.listar).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });
});
