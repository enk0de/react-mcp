import type { Plugin, PluginContext } from "../types/plugin";

/**
 * Plugin that captures all JavaScript errors including:
 * - Global runtime errors (window.onerror)
 * - Unhandled promise rejections
 * - console.error calls (even in catch blocks)
 */
export class ErrorCapturePlugin implements Plugin {
  readonly name = "ErrorCapturePlugin";

  private context: PluginContext;
  private originalConsoleError: typeof console.error;
  private originalConsoleWarn: typeof console.warn;

  constructor(context: PluginContext) {
    this.context = context;
    this.originalConsoleError = console.error;
    this.originalConsoleWarn = console.warn;
  }

  init(): void {
    this.setupGlobalErrorHandler();
    this.setupUnhandledRejectionHandler();
    this.setupConsoleOverrides();
  }

  destroy(): void {
    // Restore original console methods
    console.error = this.originalConsoleError;
    console.warn = this.originalConsoleWarn;
  }

  private setupGlobalErrorHandler(): void {
    window.addEventListener("error", (event) => {
      const errorData = {
        id: Date.now().toString(),
        message: event.message,
        stack: event.error?.stack || "",
        componentName: "Global",
        type: "runtime_error" as const,
        timestamp: Date.now(),
        file: event.filename,
        line: event.lineno,
        column: event.colno,
      };

      console.error("[React MCP] JavaScript Error:", errorData);

      this.context.addError(errorData);
      this.context.sendMessage({
        type: "JS_ERROR",
        data: errorData,
      });
    });
  }

  private setupUnhandledRejectionHandler(): void {
    window.addEventListener("unhandledrejection", (event) => {
      const errorData = {
        id: Date.now().toString(),
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack || String(event.reason),
        componentName: "Global",
        type: "unhandled_rejection" as const,
        timestamp: Date.now(),
      };

      console.error("[React MCP] Unhandled Promise Rejection:", errorData);

      this.context.addError(errorData);
      this.context.sendMessage({
        type: "JS_ERROR",
        data: errorData,
      });
    });
  }

  private setupConsoleOverrides(): void {
    // Override console.error to capture errors in catch blocks
    console.error = (...args: any[]) => {
      // Call original console.error
      this.originalConsoleError.apply(console, args);

      // Extract error information
      const firstArg = args[0];
      const isError = firstArg instanceof Error;

      const errorData = {
        id: Date.now().toString(),
        message: isError ? firstArg.message : args.join(" "),
        stack: isError ? firstArg.stack || "" : "",
        componentName: "Global",
        type: "console_error" as const,
        timestamp: Date.now(),
      };

      this.context.addError(errorData);
      this.context.sendMessage({
        type: "JS_ERROR",
        data: errorData,
      });
    };

    // Override console.warn for warnings
    console.warn = (...args: any[]) => {
      // Call original console.warn
      this.originalConsoleWarn.apply(console, args);

      // You can optionally track warnings as well
      const warningData = {
        id: Date.now().toString(),
        message: args.join(" "),
        stack: "",
        componentName: "Global",
        type: "console_warning" as const,
        timestamp: Date.now(),
      };

      this.context.sendMessage({
        type: "JS_WARNING",
        data: warningData,
      });
    };
  }
}
