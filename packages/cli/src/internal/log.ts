/**
 * Diagnostic output sink for the CLI.
 *
 * All human-facing output is funneled through a single {@link Output} instance
 * that owns its write stream, a single debug-enabled flag, and a `picocolors`
 * palette. The flag is read once from the `--debug` argument or the `GTKX_DEBUG`
 * environment variable, so verbosity is controlled by one switch. The stream is
 * injectable through the constructor so tests can capture output.
 *
 * `warn` and `error` carry a distinct colored level label so they read as
 * different severities; coloring is enabled only when `picocolors` reports color
 * support (honoring `NO_COLOR`/`FORCE_COLOR`) and the target stream is a TTY.
 */

import pc from "picocolors";

const PREFIX = "[gtkx]";

type Colors = ReturnType<typeof pc.createColors>;

/**
 * A writable target for {@link Output}. `process.stderr` satisfies this shape;
 * its optional `isTTY` flag gates colored output.
 */
export type OutputStream = {
    write(chunk: string): unknown;
    isTTY?: boolean | undefined;
};

/**
 * Reads the debug-enabled flag once from the `--debug` argument or the
 * `GTKX_DEBUG` environment variable.
 */
const resolveDebugEnabled = (argv: string[], env: NodeJS.ProcessEnv): boolean =>
    argv.includes("--debug") || env["GTKX_DEBUG"] === "1";

const colorsFor = (stream: OutputStream): Colors => pc.createColors(pc.isColorSupported && stream.isTTY === true);

/**
 * Semantic output sink with a single debug switch and an injectable stream.
 *
 * `info`, `warn`, and `error` always write; `debug` writes only when the
 * debug-enabled flag is set. `warn` and `error` prepend a colored level label so
 * the three severities are visually distinct. Every line carries the `[gtkx]`
 * prefix so all CLI output speaks one vocabulary.
 */
export class Output {
    private stream: OutputStream;
    private debugEnabled: boolean;
    private colors: Colors;

    /**
     * @param stream - The target the sink writes to.
     * @param debugEnabled - Whether {@link Output.debug} produces output.
     */
    constructor(stream: OutputStream, debugEnabled: boolean) {
        this.stream = stream;
        this.debugEnabled = debugEnabled;
        this.colors = colorsFor(stream);
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
     * Writes a warning message prefixed with a colored `warn` level label.
     */
    warn(message: string, ...rest: unknown[]): void {
        this.write(`${this.colors.yellow("warn")} ${message}`, rest);
    }

    /**
     * Writes an error message prefixed with a colored `error` level label.
     */
    error(message: string, ...rest: unknown[]): void {
        this.write(`${this.colors.red("error")} ${message}`, rest);
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
