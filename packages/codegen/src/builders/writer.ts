import type { Writable } from "./types.js";

const INDENT = "    ";

/**
 * Streaming code writer that manages indentation and line tracking.
 * Builders use this to emit formatted TypeScript source code.
 */
export class Writer {
    private readonly buffer: string[] = [];
    private currentIndent = 0;
    private atLineStart = true;

    /** Write a {@link Writable} value at the current position, applying indentation at line starts. */
    write(value: Writable): this {
        if (typeof value !== "string") {
            value.write(this);
            return this;
        }

        if (value === "") return this;

        const lines = value.split("\n");
        for (let i = 0; i < lines.length; i++) {
            if (i > 0) {
                this.buffer.push("\n");
                this.atLineStart = true;
            }

            const line = lines[i] ?? "";
            if (line.length > 0) {
                if (this.atLineStart) {
                    this.buffer.push(INDENT.repeat(this.currentIndent));
                    this.atLineStart = false;
                }
                this.buffer.push(line);
            }
        }

        return this;
    }

    /** Write a {@link Writable} value followed by a newline. If no value is given, write only the newline. */
    writeLine(value?: Writable): this {
        if (value !== undefined) {
            this.write(value);
        }
        this.buffer.push("\n");
        this.atLineStart = true;
        return this;
    }

    /** Write a bare newline without any content. */
    newLine(): this {
        this.buffer.push("\n");
        this.atLineStart = true;
        return this;
    }

    /** Execute the callback with one additional level of indentation. */
    withIndent(fn: () => void): this {
        this.currentIndent++;
        fn();
        this.currentIndent--;
        return this;
    }

    /** Write multiple items separated by the given separator string. */
    writeJoined(separator: string, items: readonly Writable[]): this {
        for (let i = 0; i < items.length; i++) {
            if (i > 0) this.write(separator);
            this.write(items[i] ?? "");
        }
        return this;
    }

    /** Write a curly-brace block, executing the callback indented between `{` and `}`. */
    writeBlock(fn: () => void): this {
        this.writeLine("{");
        this.withIndent(fn);
        this.write("}");
        return this;
    }

    /** Flush the internal buffer and return the accumulated source code. */
    toString(): string {
        return this.buffer.join("");
    }
}
