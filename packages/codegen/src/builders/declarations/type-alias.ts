import { writeJsDoc } from "../members/doc.js";
import type { Builder, Writable } from "../types.js";
import { writeWritable } from "../types.js";
import type { Writer } from "../writer.js";

/** Configuration options for a type alias declaration. */
export type TypeAliasOptions = {
    exported?: boolean;
    doc?: string;
};

/** Builder that emits a `type Name = ...` type alias declaration. */
export class TypeDeclarationBuilder implements Builder {
    constructor(
        readonly name: string,
        private readonly type: Writable,
        private readonly opts: TypeAliasOptions = {},
    ) {}

    /** @inheritdoc */
    write(writer: Writer): void {
        writeJsDoc(writer, this.opts.doc);
        if (this.opts.exported) writer.write("export ");
        writer.write(`type ${this.name} = `);
        writeWritable(writer, this.type);
        writer.writeLine(";");
    }
}

/** Create a {@link TypeDeclarationBuilder} with the given name, underlying type, and options. */
export function typeAlias(name: string, type: Writable, opts?: TypeAliasOptions): TypeDeclarationBuilder {
    return new TypeDeclarationBuilder(name, type, opts);
}
