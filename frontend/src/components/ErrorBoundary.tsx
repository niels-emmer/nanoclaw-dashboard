import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <h1 className="text-2xl font-bold text-red-400 mb-4">Dashboard Error</h1>
            <p className="text-muted mb-6">
              The dashboard encountered an unexpected error. This is usually caused by malformed telemetry data.
            </p>
            <pre className="text-xs text-left bg-surface p-4 rounded-lg overflow-auto max-h-48 mb-6 font-mono text-foreground/80">
              {this.state.error?.message}
            </pre>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-accent/20 text-accent rounded-lg hover:bg-accent/30 transition-colors font-medium"
            >
              Reload Dashboard
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
