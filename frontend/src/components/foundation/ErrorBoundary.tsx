import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps { children: ReactNode; }
interface ErrorBoundaryState { hasError: boolean; }

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Unhandled application error', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <main className="app-error" role="alert"><section><h1>Something went wrong</h1><p>Reload OrbX to try again. If this keeps happening, contact your administrator.</p><button type="button" onClick={() => window.location.reload()}>Reload OrbX</button></section></main>;
    }
    return this.props.children;
  }
}
