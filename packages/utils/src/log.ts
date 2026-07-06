import pc from "picocolors";

const BASE_PREFIX = "[gtkx]";

type Colors = ReturnType<typeof pc.createColors>;

export type OutputStream = {
    write(chunk: string): unknown;
    isTTY?: boolean | undefined;
};

export type LoggerOptions = {
    namespace?: string | undefined;
    stream?: OutputStream | undefined;
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

export class Logger {
    private stream: OutputStream;
    private prefix: string;
    private debugEnabled: boolean;
    private colors: Colors;

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

    info(message: string, ...rest: unknown[]): void {
        this.write(message, rest);
    }

    warn(message: string, ...rest: unknown[]): void {
        this.write(`${this.colors.yellow("warn")} ${message}`, rest);
    }

    error(message: string, ...rest: unknown[]): void {
        this.write(`${this.colors.red("error")} ${message}`, rest);
    }

    debug(message: string, ...rest: unknown[]): void {
        if (!this.debugEnabled) return;
        this.write(message, rest);
    }
}

export const createLogger = (namespace: string, options: Omit<LoggerOptions, "namespace"> = {}): Logger =>
    new Logger({ ...options, namespace });

export const logger: Logger = new Logger();

export const info = (message: string, ...rest: unknown[]): void => logger.info(message, ...rest);

export const warn = (message: string, ...rest: unknown[]): void => logger.warn(message, ...rest);

export const error = (message: string, ...rest: unknown[]): void => logger.error(message, ...rest);

export const debug = (message: string, ...rest: unknown[]): void => logger.debug(message, ...rest);
