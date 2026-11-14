import { Component, type ReactNode } from 'react'
import { SkBanner } from '@skelloapp/skello-ds-web'

interface Props {
  resetKey: string
  onHome: () => void
  children: ReactNode
}

interface State {
  error: Error | null
}

// React 19 has no hook for this: an error boundary must be a class.
export class PageErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidUpdate(previous: Props) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) {
      this.setState({ error: null })
    }
  }

  render() {
    if (this.state.error) {
      return (
        <SkBanner
          severity="error"
          direction="row"
          title="This view failed to render"
          description={this.state.error.message}
          actionLabel="Go home"
          onActionClick={this.props.onHome}
        />
      )
    }
    return this.props.children
  }
}
