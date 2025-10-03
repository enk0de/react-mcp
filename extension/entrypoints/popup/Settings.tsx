import { DEFAULT_PORT } from "@react-mcp/core";
import React, { useState } from "react";
import { usePortStorage } from "../../hooks/usePortStorage";

export function Settings() {
  const { port, updatePort, resetPort } = usePortStorage();
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (port !== null) {
      setInputValue(String(port));
    }
  }, [port]);

  const handleSave = async () => {
    const portNumber = parseInt(inputValue, 10);

    if (isNaN(portNumber)) {
      setError("Please enter a valid number");
      return;
    }

    if (portNumber < 1 || portNumber > 65535) {
      setError("Port must be between 1 and 65535");
      return;
    }

    setError("");
    await updatePort(portNumber);
  };

  const handleReset = async () => {
    setError("");
    await resetPort();
  };

  if (port === null) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h2 style={styles.title}>React MCP Settings</h2>
      </div>

      <div style={styles.section}>
        <label style={styles.label}>WebSocket Port</label>
        <input
          type="number"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          min="1"
          max="65535"
          style={styles.input}
          placeholder={String(DEFAULT_PORT)}
        />
        {error && <div style={styles.error}>{error}</div>}
        <div style={styles.hint}>Default: {DEFAULT_PORT}</div>
      </div>

      <div style={styles.buttons}>
        <button onClick={handleSave} style={styles.primaryButton}>
          Save
        </button>
        <button onClick={handleReset} style={styles.secondaryButton}>
          Reset to Default
        </button>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: "320px",
    padding: "20px",
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    backgroundColor: "#ffffff",
  },
  header: {
    marginBottom: "20px",
  },
  title: {
    margin: "0",
    fontSize: "18px",
    fontWeight: "600",
    color: "#1a1a1a",
  },
  section: {
    marginBottom: "20px",
  },
  label: {
    display: "block",
    marginBottom: "8px",
    fontSize: "14px",
    fontWeight: "500",
    color: "#4a4a4a",
  },
  input: {
    width: "100%",
    padding: "10px 12px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "14px",
    boxSizing: "border-box",
    outline: "none",
    transition: "border-color 0.2s",
  },
  hint: {
    marginTop: "6px",
    fontSize: "12px",
    color: "#6b7280",
  },
  error: {
    marginTop: "6px",
    fontSize: "12px",
    color: "#ef4444",
  },
  buttons: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  primaryButton: {
    padding: "10px 16px",
    border: "none",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "500",
    backgroundColor: "#3b82f6",
    color: "#ffffff",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },
  secondaryButton: {
    padding: "10px 16px",
    border: "1px solid #d1d5db",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "500",
    backgroundColor: "#ffffff",
    color: "#4a4a4a",
    cursor: "pointer",
    transition: "all 0.2s",
  },
  loading: {
    textAlign: "center",
    padding: "40px",
    color: "#6b7280",
  },
};
