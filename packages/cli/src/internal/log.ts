/**
 * Diagnostic output sink for the CLI.
 *
 * All human-facing output is funneled through a single {@link Output} instance
 * that owns its write stream and a single debug-enabled flag. The flag is read
 * once from the `--debug` argument or the `GTKX_DEBUG` environment variable, so
 * verbosity is controlled by one switch. The stream is injectable through the
 * constructor so tests can capture output.
 */

const PREFIX = "[gtkx]";

/**
 * A writable target for {@link Output}. `process.stderr` satisfies this shape.
 */
export type OutputStream = {
    write(chunk: string): unknown;
};

/**
 * Reads the debug-enabled flag once from the `--debug` argument or the
 * `GTKX_DEBUG` environment variable.
 */
const resolveDebugEnabled = (argv: string[], env: NodeJS.ProcessEnv): boolean =>
    argv.includes("--debug") || env["GTKX_DEBUG"] === "1";

/**
 * Semantic output sink with a single debug switch and an injectable stream.
 *
 * `info`, `warn`, and `error` always write; `debug` writes only when the
 * debug-enabled flag is set. Every line carries the `[gtkx]` prefix so all CLI
 * output speaks one vocabulary.
 */
export class Output {
    private stream: OutputStream;
    private debugEnabled: boolean;

    /**
     * @param stream - The target the sink writes to.
     * @param debugEnabled - Whether {@link Output.debug} produces output.
     */
    constructor(stream: OutputStream, debugEnabled: boolean) {
        this.stream = stream;
        this.debugEnabled = debugEnabled;
    }

    private write(message: string, rest: unknown[]): void {
        const suffix = rest.length === 0 ? "" : ` ${rest.map((value) => formatValue(value)).join(" ")}`;
        this.stream.write(`${PREFIX} ${message}${suffix}\n`);
    }

    /**
     * Writes an informational message.
     */
    info(message: string, ...rest: unknown[]): void {
        this.write(message, rest);
    }

    /**
     * Writes a warning message.
     */
    warn(message: string, ...rest: unknown[]): void {
        this.write(message, rest);
    }

    /**
     * Writes an error message.
     */
    error(message: string, ...rest: unknown[]): void {
        this.write(message, rest);
    }

    /**
     * Writes a diagnostic message only when the debug-enabled flag is set.
     */
    debug(message: string, ...rest: unknown[]): void {
        if (!this.debugEnabled) return;
        this.write(message, rest);
    }
}

const formatValue = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (value instanceof Error) return value.stack ?? value.message;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

/**
 * Process-wide output sink writing to `process.stderr`, with debug gating read
 * once from the process arguments and environment.
 */
export const output = new Output(process.stderr, resolveDebugEnabled(process.argv, process.env));

/**
 * Writes an informational message through the process-wide {@link output} sink.
 */
export const info = (message: string, ...rest: unknown[]): void => output.info(message, ...rest);

/**
 * Writes a warning message through the process-wide {@link output} sink.
 */
export const warn = (message: string, ...rest: unknown[]): void => output.warn(message, ...rest);

/**
 * Writes an error message through the process-wide {@link output} sink.
 */
export const error = (message: string, ...rest: unknown[]): void => output.error(message, ...rest);
