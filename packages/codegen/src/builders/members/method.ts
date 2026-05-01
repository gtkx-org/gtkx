import type { Builder, Writable } from "../types.js";
import { writeWritable } from "../types.js";
import type { Writer } from "../writer.js";
import { type BodyContent, writeBody } from "./body.js";
import { writeJsDoc } from "./doc.js";
import type { ParameterBuilder } from "./parameter.js";

/** A single overload signature for a method with its parameter list and return type. */
export type OverloadSignature = {
    params: ParameterBuilder[];
    returnType?: Writable;
};

/** Configuration options for a class method declaration. */
export type MethodOptions = {
    params?: ParameterBuilder[];
    returnType?: Writable;
    body?: BodyContent;
    isStatic?: boolean;
    override?: boolean;
    abstract?: boolean;
    doc?: string;
    overloads?: OverloadSignature[];
};

/**
 * Builder that emits a class method declaration with modifiers, parameters,
 * return type, optional body, and optional overload signatures.
 */
export class MethodBuilder implements Builder {
    constructor(
        readonly name: string,
        private readonly opts: MethodOptions,
    ) {}

    /** @inheritdoc */
    write(writer: Writer): void {
        if (this.opts.overloads) {
            for (const overload of this.opts.overloads) {
                this.writeSignature(writer, this.name, overload.params, overload.returnType);
                writer.writeLine(";");
            }
        }

        writeJsDoc(writer, this.opts.doc);
        if (this.opts.isStatic) writer.write("static ");
        if (this.opts.override) writer.write("override ");
        if (this.opts.abstract) writer.write("abstract ");

        writer.write(`${this.name}(`);
        if (this.opts.params && this.opts.params.length > 0) {
            writer.writeJoined(", ", this.opts.params);
        }
        writer.write(")");

        if (this.opts.returnType) {
            writer.write(": ");
            writeWritable(writer, this.opts.returnType);
        } else if (this.opts.body && !this.opts.abstract) {
            writer.write(": void");
        }

        if (this.opts.abstract || (!this.opts.body && !this.opts.overloads)) {
            writer.writeLine(";");
            return;
        }

        writer.write(" ");
        writeBody(writer, this.opts.body);
        writer.newLine();
    }

    private writeSignature(
        writer: Writer,
        name: string,
        params: ParameterBuilder[],
        returnType: Writable | undefined,
    ): void {
        if (this.opts.isStatic) writer.write("static ");
        writer.write(`${name}(`);
        if (params.length > 0) {
            writer.writeJoined(", ", params);
        }
        writer.write(")");
        if (returnType) {
            writer.write(": ");
            writeWritable(writer, returnType);
        }
    }
}

/** Create a {@link MethodBuilder} with the given name and options. */
export function method(name: string, opts: MethodOptions): MethodBuilder {
    return new MethodBuilder(name, opts);
}
