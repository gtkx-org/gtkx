/**
 * Error subclass thrown by the GTKX reconciler and rendering pipeline.
 *
 * Carries optional context about the widget type that failed and the
 * React component stack at the point of failure.
 */
export class GtkxError extends Error {
    constructor(
        message: string,
        public widgetType?: string,
        public componentStack?: string,
    ) {
        super(message);
        this.name = "GtkxError";

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, GtkxError);
        }
    }

    override toString(): string {
        const parts = [`GtkxError: ${this.message}`];

        if (this.widgetType) {
            parts.push(`Widget Type: ${this.widgetType}`);
        }

        if (this.componentStack) {
            parts.push(`Component Stack:\n${this.componentStack}`);
        }

        return parts.join("\n");
    }
}

function formatUnknownError(error: unknown): string {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    if (typeof error === "number" || typeof error === "boolean") return String(error);
    return "Unknown error";
}

/**
 * Wraps an unknown thrown value in a {@link GtkxError}.
 *
 * Returns the input unchanged when it is already a {@link GtkxError}; otherwise
 * extracts a human-readable message from common error shapes (`Error`,
 * `string`, `number`, `boolean`) and falls back to "Unknown error" for
 * anything else.
 *
 * @param error - The thrown value to normalize.
 * @returns A {@link GtkxError} carrying the extracted message.
 */
export function toGtkxError(error: unknown): GtkxError {
    if (error instanceof GtkxError) {
        return error;
    }

    const message = formatUnknownError(error);
    return new GtkxError(message);
}
