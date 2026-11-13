import { Component, ReactNode } from "react";

/** A page that fails to draw says so and offers a way back, instead of leaving an empty screen. */
export default class CrashScreen extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: unknown) { console.error(error); }
  render() {
    if (!this.state.failed) return this.props.children;
    return <div className="loading-screen" role="alert"><div style={{ textAlign: "center", padding: "var(--s4)" }}>
      <h1>This page could not be shown.</h1>
      <p style={{ margin: "var(--s3) 0 var(--s4)" }}>Your answers and results are saved. Reload to carry on.</p>
      <button className="btn btn-primary" onClick={() => window.location.reload()}>Reload</button>
    </div></div>;
  }
}
