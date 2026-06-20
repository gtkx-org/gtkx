export const errorMessage = (error: unknown): string => (error instanceof Error ? error.message : String(error));

const readStream = (value: unknown): string => {
    if (typeof value === "string") return value;
    if (value instanceof Uint8Array || Buffer.isBuffer(value)) return value.toString();
    return "";
};

export const formatChildProcessError = (error: unknown): string | undefined => {
    if (typeof error !== "object" || error === null) return undefined;
    const { stderr, stdout } = error as { stderr?: unknown; stdout?: unknown };
    const details = [readStream(stderr), readStream(stdout)].filter(Boolean).join("\n").trim();
    return details.length > 0 ? details : undefined;
};
