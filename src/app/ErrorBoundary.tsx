import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface Estado {
  error: Error | null;
}

/** Si una pantalla falla, muestra un mensaje en lugar de dejar la app en blanco. */
export class ErrorBoundary extends Component<Props, Estado> {
  state: Estado = { error: null };

  static getDerivedStateFromError(error: Error): Estado {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error en pantalla', error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="pantalla-centro" role="alert">
        <p>Algo salió mal en esta pantalla.</p>
        <p className="tenue">{this.state.error.message}</p>
        <button type="button" className="boton boton-principal" onClick={() => window.location.reload()}>
          Volver a cargar
        </button>
      </div>
    );
  }
}
