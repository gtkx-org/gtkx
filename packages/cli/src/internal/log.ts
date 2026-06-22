import pc from "picocolors";

const PREFIX = "[gtkx]";

type Colors = ReturnType<typeof pc.createColors>;

export type OutputStream = {
    write(chunk: string): unknown;
    isTTY?: boolean | undefined;
};

const resolveDebugEnabled = (argv: string[], env: NodeJS.ProcessEnv): boolean =>
    argv.includes("--debug") || env["GTKX_DEBUG"] === "1";

const colorsFor = (stream: OutputStream): Colors => pc.createColors(pc.isColorSupported && stream.isTTY === true);

export class Output {
    private stream: OutputStream;
    private debugEnabled: boolean;
    private colors: Colors;

    constructor(stream: OutputStream, debugEnabled: boolean) {
        this.stream = stream;
        this.debugEnabled = debugEnabled;
        this.colors = colorsFor(stream);
    }

    private write(message: string, rest: unknown[]): void {
        const suffix = rest.length === 0 ? "" : ` ${rest.map((value) => formatValue(value)).join(" ")}`;
        this.stream.write(`${PREFIX} ${message}${suffix}\n`);
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

const formatValue = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (value instanceof Error) return value.stack ?? value.message;
    try {
        return JSON.stringify(value);
    } catch {
        return String(value);
    }
};

export const output = new Output(process.stderr, resolveDebugEnabled(process.argv, process.env));

export const info = (message: string, ...rest: unknown[]): void => output.info(message, ...rest);

export const warn = (message: string, ...rest: unknown[]): void => output.warn(message, ...rest);

export const error = (message: string, ...rest: unknown[]): void => output.error(message, ...rest);
