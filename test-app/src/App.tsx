import { ErrorBoundary, Suspense } from "@suspensive/react";
import { useState } from "react";
import "./App.css";
import Counter from "./components/Counter";
import UserCard from "./components/UserCard";

function App() {
  const [showError, setShowError] = useState(false);

  if (showError) {
    throw new Error("Test React Error!");
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>React MCP Test App :)</h1>
        <p>Test app for React MCP browser extension</p>
      </header>

      <main className="app-main">
        <section className="section">
          <h2>Counter Component</h2>
          <Counter />
        </section>

        <section className="section">
          <h2>User Cards</h2>
          <div className="card-grid">
            <UserCard name="Alice" role="Developer" />{" "}
            <ErrorBoundary
              fallback={(props) => (
                <>
                  <button onClick={props.reset}>Try again</button>
                  {props.error.message}
                </>
              )}
            >
              <Suspense>
                <UserCard name="Bob" role="Designer" />
              </Suspense>
            </ErrorBoundary>
            <UserCard name="Charlie" role="Manager" />
          </div>
        </section>

        <section className="section">
          <h2>Test Error Boundary</h2>
          <button className="error-button" onClick={() => setShowError(true)}>
            Trigger Error
          </button>
          <p style={{ fontSize: "14px", color: "#666" }}>
            Click to test error detection and overlay
          </p>
        </section>

        <section className="section">
          <h2>Instructions</h2>
          <ul className="instructions">
            <li>
              Hold <kbd>Alt/Option</kbd> and click any component to inspect it
            </li>
            <li>Component information will be sent to the MCP server</li>
            <li>Check console for React MCP extension logs</li>
            <li>Errors will show a red ! icon overlay</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

export default App;
