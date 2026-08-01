import pc from "picocolors";

type Colors = ReturnType<typeof pc.createColors>;

type OutputStream = {
    write(chunk: string): unknown;
    isTTY?: boolean | undefined;
};

type LoggerOptions = {
    namespace?: string | undefined;
    stream?: OutputStream | undefined;
    isDebugEnabled?: boolean | undefined;
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

class Logger {
    private stream: OutputStream;
    private prefix: string;
    private isDebugEnabled: boolean;
    private colors: Colors;

    constructor(options: LoggerOptions = {}) {
        this.stream = options.stream ?? process.stderr;
        this.prefix = getPrefix(options.namespace);
        this.isDebugEnabled = options.isDebugEnabled ?? isDebugEnabled(options.namespace, process.argv, process.env);
        this.colors = getColors(this.stream);
    }

    private write(message: string, rest: unknown[]): void {
        const suffix = rest.length === 0 ? "" : ` ${rest.map((value) => formatValue(value)).join(" ")}`;
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
        if (!this.isDebugEnabled) {
            return;
        }

        this.write(message, rest);
    }
}

export { Logger, type OutputStream, type LoggerOptions };
