import pc from "picocolors";

const BASE_PREFIX = "[gtkx]";

type Colors = ReturnType<typeof pc.createColors>;

/**
 * Minimal writable-stream shape a {@link Logger} writes formatted lines to.
 */
export type OutputStream = {
    write(chunk: string): unknown;
    /** Whether the stream is a terminal, used to decide if colored output is emitted. */
    isTTY?: boolean | undefined;
};

/**
 * Options for constructing a {@link Logger}.
 */
export type LoggerOptions = {
    /** Namespace appended to the log prefix and matched against debug configuration. */
    namespace?: string | undefined;
    /** Stream to write log lines to; defaults to `process.stderr`. */
    stream?: OutputStream | undefined;
    /** Forces debug output on or off; when omitted it is resolved from `--debug` and `GTKX_DEBUG`. */
    debugEnabled?: boolean | undefined;
};

const colorsFor = (stream: OutputStream): Colors => pc.createColors(pc.isColorSupported && stream.isTTY === true);

const formatValue = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (value instanceof Error) return value.stack ?? value.message;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

const resolveDebugEnabled = (namespace: string | undefined, argv: string[], env: NodeJS.ProcessEnv): boolean => {
    if (argv.includes("--debug")) return true;
    const spec = env.GTKX_DEBUG;
    if (!spec) return false;
    const names = spec.split(/[\s,]+/).filter((name) => name.length > 0);
    if (names.includes("1") || names.includes("*")) return true;
    return namespace !== undefined && names.includes(namespace);
};

const prefixFor = (namespace: string | undefined): string =>
    namespace === undefined ? BASE_PREFIX : `[gtkx:${namespace}]`;

/**
 * Writes prefixed, optionally colored log lines to an output stream, with debug lines gated by
 * command-line and environment configuration.
 */
export class Logger {
    private stream: OutputStream;
    private prefix: string;
    private debugEnabled: boolean;
    private colors: Colors;

    /**
     * @param options Namespace, target stream, and debug configuration for the logger.
     */
    constructor(options: LoggerOptions = {}) {
        this.stream = options.stream ?? process.stderr;
        this.prefix = prefixFor(options.namespace);
        this.debugEnabled = options.debugEnabled ?? resolveDebugEnabled(options.namespace, process.argv, process.env);
        this.colors = colorsFor(this.stream);
    }

    private write(message: string, rest: unknown[]): void {
        const suffix = rest.length === 0 ? "" : ` ${rest.map(formatValue).join(" ")}`;
        this.stream.write(`${this.prefix} ${message}${suffix}\n`);
    }

    /**
     * Writes an informational line.
     *
     * @param message The message text.
     * @param rest Extra values appended after the message, formatted for display.
     */
    info(message: string, ...rest: unknown[]): void {
        this.write(message, rest);
    }

    /**
     * Writes a line marked as a warning.
     *
     * @param message The message text.
     * @param rest Extra values appended after the message, formatted for display.
     */
    warn(message: string, ...rest: unknown[]): void {
        this.write(`${this.colors.yellow("warn")} ${message}`, rest);
    }

    /**
     * Writes a line marked as an error.
     *
     * @param message The message text.
     * @param rest Extra values appended after the message, formatted for display.
     */
    error(message: string, ...rest: unknown[]): void {
        this.write(`${this.colors.red("error")} ${message}`, rest);
    }

    /**
     * Writes a line only when debug output is enabled for this logger.
     *
     * @param message The message text.
     * @param rest Extra values appended after the message, formatted for display.
     */
    debug(message: string, ...rest: unknown[]): void {
        if (!this.debugEnabled) return;
        this.write(message, rest);
    }
}

/**
 * Creates a {@link Logger} scoped to the given namespace.
 *
 * @param namespace Namespace added to the log prefix and matched against debug configuration.
 * @param options Further logger options excluding the namespace.
 */
export const createLogger = (namespace: string, options: Omit<LoggerOptions, "namespace"> = {}): Logger =>
    new Logger({ ...options, namespace });

/**
 * The default namespace-less {@link Logger} backing the module-level {@link info}, {@link warn},
 * {@link error}, and {@link debug} functions.
 */
export const logger: Logger = new Logger();

/**
 * Writes an informational line through the shared {@link logger}.
 *
 * @param message The message text.
 * @param rest Extra values appended after the message, formatted for display.
 */
export const info = (message: string, ...rest: unknown[]): void => logger.info(message, ...rest);

/**
 * Writes a warning line through the shared {@link logger}.
 *
 * @param message The message text.
 * @param rest Extra values appended after the message, formatted for display.
 */
export const warn = (message: string, ...rest: unknown[]): void => logger.warn(message, ...rest);

/**
 * Writes an error line through the shared {@link logger}.
 *
 * @param message The message text.
 * @param rest Extra values appended after the message, formatted for display.
 */
export const error = (message: string, ...rest: unknown[]): void => logger.error(message, ...rest);

/**
 * Writes a debug line through the shared {@link logger} when debug output is enabled.
 *
 * @param message The message text.
 * @param rest Extra values appended after the message, formatted for display.
 */
export const debug = (message: string, ...rest: unknown[]): void => logger.debug(message, ...rest);
