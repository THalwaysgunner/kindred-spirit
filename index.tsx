import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

class RootErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error?: unknown }
> {
  state: { error?: unknown } = {};

  static getDerivedStateFromError(error: unknown) {
    return { error };
  }

  componentDidCatch(error: unknown) {
    // Make sure the error is visible in the console
    console.error("[RootErrorBoundary]", error);
  }

  render() {
    if (this.state.error) {
      const message =
        this.state.error instanceof Error
          ? this.state.error.message
          : String(this.state.error);

      return (
        <div className="min-h-screen w-full flex items-center justify-center p-6">
          <div className="max-w-xl w-full rounded-xl border border-border bg-card p-6 text-card-foreground">
            <h1 className="text-xl font-semibold">App failed to start</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              There is a runtime error preventing React from rendering.
            </p>
            <pre className="mt-4 whitespace-pre-wrap break-words rounded-lg bg-muted p-4 text-xs">
              {message}
            </pre>
            <p className="mt-4 text-sm text-muted-foreground">
              Fix the error above, then refresh.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Could not find #root element");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  </React.StrictMode>
);
