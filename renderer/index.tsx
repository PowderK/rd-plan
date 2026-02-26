import React, { Component, ErrorInfo, ReactNode } from 'react';
import './styles.css';
import { createRoot } from 'react-dom/client';
import App from './App';

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, error: Error | null, info: ErrorInfo | null }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null, info: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    this.setState({ info });
    console.error("ErrorBoundary caught an error", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red', background: 'white', overflow: 'auto', height: '100vh', width: '100vw', zIndex: 99999 }}>
          <h1>React App Crashed</h1>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.error?.toString()}</pre>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{this.state.info?.componentStack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

const container = document.getElementById('app');
if (container) {
  const root = createRoot(container);
  root.render(<ErrorBoundary><App /></ErrorBoundary>);
}
