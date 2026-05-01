import type { Builder, Writable } from "../types.js";
import { writeWritable } from "../types.js";
import type { Writer } from "../writer.js";
import { type BodyContent, writeBody } from "./body.js";
import { writeJsDoc } from "./doc.js";

/** Configuration options for a class accessor (ES6 get/set) declaration. */
export type AccessorOptions = {
    type: Writable;
    setType?: Writable;
    getBody: BodyContent;
    setBody?: BodyContent;
    doc?: string;
};

/**
 * Builder that emits a paired ES6 get/set accessor declaration.
 * When setBody is omitted, only a getter is emitted (read-only accessor).
 */
export class AccessorBuilder implements Builder {
    constructor(
        readonly name: string,
        private readonly opts: AccessorOptions,
    ) {}

    /** @inheritdoc */
    write(writer: Writer): void {
        writeJsDoc(writer, this.opts.doc);
        writer.write(`get ${this.name}(): `);
        writeWritable(writer, this.opts.type);
        writer.write(" ");
        writeBody(writer, this.opts.getBody);
        writer.newLine();

        if (this.opts.setBody) {
            writer.write(`set ${this.name}(value: `);
            writeWritable(writer, this.opts.setType ?? this.opts.type);
            writer.write(") ");
            writeBody(writer, this.opts.setBody);
            writer.newLine();
        }
    }
}

/** Create an {@link AccessorBuilder} with the given name and options. */
export function accessor(name: string, opts: AccessorOptions): AccessorBuilder {
    return new AccessorBuilder(name, opts);
}
