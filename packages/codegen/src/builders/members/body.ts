import type { Writer } from "../writer.js";

/** Content for a method/constructor/accessor body: literal lines or an explicit writer callback. */
export type BodyContent = string[] | ((writer: Writer) => void);

/**
 * Emits a brace-delimited block from a body that is either a list of source lines
 * or a function that writes directly to the underlying writer.
 *
 * If the body is `undefined`, an empty block is emitted.
 */
export function writeBody(writer: Writer, body: BodyContent | undefined): void {
    writer.writeBlock(() => {
        if (typeof body === "function") {
            body(writer);
        } else if (body) {
            for (const line of body) {
                writer.writeLine(line);
            }
        }
    });
}
