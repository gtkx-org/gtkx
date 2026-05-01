import { writeJsDoc } from "../members/doc.js";
import type { ParameterBuilder } from "../members/parameter.js";
import type { Builder, Writable } from "../types.js";
import { writeWritable } from "../types.js";
import type { Writer } from "../writer.js";

/** A property signature within an interface declaration. */
export type InterfacePropertySignature = {
    name: string;
    type: Writable;
    optional?: boolean;
    readonly?: boolean;
    doc?: string;
};

/** A method signature within an interface declaration. */
export type InterfaceMethodSignature = {
    name: string;
    params?: ParameterBuilder[];
    returnType?: Writable;
    doc?: string;
};

/** Configuration options for an interface declaration. */
export type InterfaceOptions = {
    exported?: boolean;
    extends?: string[];
    doc?: string;
};

/** Builder that emits a TypeScript interface declaration with properties and methods. */
export class InterfaceDeclarationBuilder implements Builder {
    private readonly properties: InterfacePropertySignature[] = [];
    private readonly methods: InterfaceMethodSignature[] = [];

    constructor(
        readonly name: string,
        private readonly opts: InterfaceOptions = {},
    ) {}

    /** Add a property signature to the interface body. */
    addProperty(sig: InterfacePropertySignature): this {
        this.properties.push(sig);
        return this;
    }

    /** Add a method signature to the interface body. */
    addMethod(sig: InterfaceMethodSignature): this {
        this.methods.push(sig);
        return this;
    }

    /** @inheritdoc */
    write(writer: Writer): void {
        writeJsDoc(writer, this.opts.doc);
        if (this.opts.exported) writer.write("export ");
        writer.write(`interface ${this.name}`);
        if (this.opts.extends && this.opts.extends.length > 0) {
            writer.write(` extends ${this.opts.extends.join(", ")}`);
        }
        writer.write(" ");
        writer.writeBlock(() => {
            for (const prop of this.properties) {
                writeJsDoc(writer, prop.doc);
                if (prop.readonly) writer.write("readonly ");
                writer.write(prop.name);
                if (prop.optional) writer.write("?");
                writer.write(": ");
                writeWritable(writer, prop.type);
                writer.writeLine(";");
            }
            for (const m of this.methods) {
                writeJsDoc(writer, m.doc);
                writer.write(`${m.name}(`);
                if (m.params && m.params.length > 0) {
                    writer.writeJoined(", ", m.params);
                }
                writer.write(")");
                if (m.returnType) {
                    writer.write(": ");
                    writeWritable(writer, m.returnType);
                }
                writer.writeLine(";");
            }
        });
        writer.newLine();
    }
}

/** Create an {@link InterfaceDeclarationBuilder} with the given name and options. */
export function interfaceDecl(name: string, opts?: InterfaceOptions): InterfaceDeclarationBuilder {
    return new InterfaceDeclarationBuilder(name, opts);
}
