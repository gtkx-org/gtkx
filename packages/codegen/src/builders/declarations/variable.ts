import { writeJsDoc } from "../members/doc.js";
import type { Builder, Writable } from "../types.js";
import { writeWritable } from "../types.js";
import type { Writer } from "../writer.js";

/** The declaration keyword for a variable statement. */
export type VariableKind = "const" | "let";

/** Configuration options for a variable statement. */
export type VariableOptions = {
    kind?: VariableKind;
    exported?: boolean;
    type?: Writable;
    initializer?: string | ((writer: Writer) => void);
    doc?: string;
};

/** Builder that emits a variable statement (`const`/`let`) with optional type annotation and initializer. */
export class VariableStatementBuilder implements Builder {
    constructor(
        readonly name: string,
        private readonly opts: VariableOptions = {},
    ) {}

    /** @inheritdoc */
    write(writer: Writer): void {
        writeJsDoc(writer, this.opts.doc);
        if (this.opts.exported) writer.write("export ");
        writer.write(`${this.opts.kind ?? "const"} ${this.name}`);
        if (this.opts.type) {
            writer.write(": ");
            writeWritable(writer, this.opts.type);
        }
        if (this.opts.initializer) {
            writer.write(" = ");
            if (typeof this.opts.initializer === "function") {
                this.opts.initializer(writer);
            } else {
                writer.write(this.opts.initializer);
            }
        }
        writer.writeLine(";");
    }
}

/** Create a {@link VariableStatementBuilder} with the given name and options. */
export function variableStatement(name: string, opts: VariableOptions): VariableStatementBuilder {
    return new VariableStatementBuilder(name, opts);
}
