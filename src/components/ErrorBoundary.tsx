import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  label?: string;
}
interface State {
  error: Error | null;
}

/** Catches render errors in a subtree so a faulty visual can't blank the app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary:", error, info);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-40 flex-col items-center justify-center gap-1 rounded-lg border border-bad/30 bg-bad/5 px-4 text-center text-xs text-bad">
          <span>{this.props.label ?? "Something went wrong rendering this section"}.</span>
          <span className="text-muted">{this.state.error.message}</span>
        </div>
      );
    }
    return this.props.children;
  }
}
