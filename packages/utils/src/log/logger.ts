import pc from "picocolors";

type Colors = ReturnType<typeof pc.createColors>;

/**
 * Minimal writable-stream shape a {@link Logger} writes formatted lines to.
 */
type OutputStream = {
    write(chunk: string): unknown;
    /** Whether the stream is a terminal, used to decide if colored output is emitted. */
    isTTY?: boolean | undefined;
};

/**
 * Options for constructing a {@link Logger}.
 */
type LoggerOptions = {
    /** Namespace appended to the log prefix and matched against debug configuration. */
    namespace?: string | undefined;
    /** Stream to write log lines to; defaults to `process.stderr`. */
    stream?: OutputStream | undefined;
    /** Forces debug output on or off; when omitted it is resolved from `--debug` and `GTKX_DEBUG`. */
    debugEnabled?: boolean | undefined;
};

const BASE_PREFIX = "[gtkx]";

function getColors(stream: OutputStream): Colors {
    return pc.createColors(pc.isColorSupported && stream.isTTY === true);
}

function formatValue(value: unknown): string {
    if (typeof value === "string") {
        return value;
    }

    if (value instanceof Error) {
        return value.stack ?? value.message;
    }

    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
}

function isDebugEnabled(namespace: string | undefined, argv: string[], env: NodeJS.ProcessEnv): boolean {
    if (argv.includes("--debug")) {
        return true;
    }

    const spec = env.GTKX_DEBUG;

    if (!spec) {
        return false;
    }

    const names = new Set(spec.split(/[\s,]+/).filter((name) => name.length > 0));

    if (names.has("1") || names.has("*")) {
        return true;
    }

    return namespace !== undefined && names.has(namespace);
}

function getPrefix(namespace: string | undefined): string {
    return namespace === undefined ? BASE_PREFIX : `[gtkx:${namespace}]`;
}

/**
 * Writes prefixed, optionally colored log lines to an output stream, with debug lines gated by
 * command-line and environment configuration.
 */
class Logger {
    private stream: OutputStream;
    private prefix: string;
    private debugEnabled: boolean;
    private colors: Colors;

    /**
     * @param options - Namespace, target stream, and debug configuration for the logger.
     */
    constructor(options: LoggerOptions = {}) {
        this.stream = options.stream ?? process.stderr;
        this.prefix = getPrefix(options.namespace);
        this.debugEnabled = options.debugEnabled ?? isDebugEnabled(options.namespace, process.argv, process.env);
        this.colors = getColors(this.stream);
    }

    private write(message: string, rest: unknown[]): void {
        const suffix = rest.length === 0 ? "" : ` ${rest.map((value) => formatValue(value)).join(" ")}`;
        this.stream.write(`${this.prefix} ${message}${suffix}\n`);
    }

    /**
     * Writes an informational line.
     *
     * @param message - The message text.
     * @param rest - Extra values appended after the message, formatted for display.
     */
    info(message: string, ...rest: unknown[]): void {
        this.write(message, rest);
    }

    /**
     * Writes a line marked as a warning.
     *
     * @param message - The message text.
     * @param rest - Extra values appended after the message, formatted for display.
     */
    warn(message: string, ...rest: unknown[]): void {
        this.write(`${this.colors.yellow("warn")} ${message}`, rest);
    }

    /**
     * Writes a line marked as an error.
     *
     * @param message - The message text.
     * @param rest - Extra values appended after the message, formatted for display.
     */
    error(message: string, ...rest: unknown[]): void {
        this.write(`${this.colors.red("error")} ${message}`, rest);
    }

    /**
     * Writes a line only when debug output is enabled for this logger.
     *
     * @param message - The message text.
     * @param rest - Extra values appended after the message, formatted for display.
     */
    debug(message: string, ...rest: unknown[]): void {
        if (!this.debugEnabled) {
            return;
        }

        this.write(message, rest);
    }
}

export { Logger, type OutputStream, type LoggerOptions };
