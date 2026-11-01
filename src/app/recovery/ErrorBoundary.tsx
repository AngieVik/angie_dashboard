import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'

export class ErrorBoundary extends Component<{
  children: ReactNode
  fallback: (retry: () => void) => ReactNode
  scope: string
}, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() { return { failed: true } }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Fallo de interfaz en ' + this.props.scope, error, info.componentStack)
  }

  private retry = () => { this.setState({ failed: false }) }

  render() {
    return this.state.failed ? this.props.fallback(this.retry) : this.props.children
  }
}
