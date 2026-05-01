import { writeJsDoc } from "../members/doc.js";
import type { Builder } from "../types.js";
import type { Writer } from "../writer.js";

/** A single member within an enum declaration. */
export type EnumMember = {
    name: string;
    value?: number | string;
    doc?: string;
};

/** Configuration options for an enum declaration. */
export type EnumOptions = {
    exported?: boolean;
    doc?: string;
    const?: boolean;
};

/** Builder that emits a TypeScript enum declaration with named members. */
export class EnumDeclarationBuilder implements Builder {
    private readonly members: EnumMember[] = [];

    constructor(
        readonly name: string,
        private readonly opts: EnumOptions = {},
    ) {}

    /** Add a member to the enum body. */
    addMember(member: EnumMember): this {
        this.members.push(member);
        return this;
    }

    /** @inheritdoc */
    write(writer: Writer): void {
        writeJsDoc(writer, this.opts.doc);
        if (this.opts.exported) writer.write("export ");
        if (this.opts.const) writer.write("const ");
        writer.write(`enum ${this.name} `);
        writer.writeBlock(() => {
            for (const member of this.members) {
                writeJsDoc(writer, member.doc);
                writer.write(member.name);
                if (member.value !== undefined) {
                    writer.write(` = ${member.value}`);
                }
                writer.writeLine(",");
            }
        });
        writer.newLine();
    }
}

/** Create an {@link EnumDeclarationBuilder} with the given name and options. */
export function enumDecl(name: string, opts?: EnumOptions): EnumDeclarationBuilder {
    return new EnumDeclarationBuilder(name, opts);
}
