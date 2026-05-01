import type { Builder } from "../types.js";
import type { Writer } from "../writer.js";
import { type BodyContent, writeBody } from "./body.js";
import type { OverloadSignature } from "./method.js";
import type { ParameterBuilder } from "./parameter.js";

/** Configuration options for a class constructor declaration. */
export type ConstructorOptions = {
    params?: ParameterBuilder[];
    body?: BodyContent;
    overloads?: OverloadSignature[];
};

/** Builder that emits a class constructor with parameters, body, and optional overload signatures. */
export class ConstructorBuilder implements Builder {
    constructor(private readonly opts: ConstructorOptions) {}

    /** @inheritdoc */
    write(writer: Writer): void {
        if (this.opts.overloads) {
            for (const overload of this.opts.overloads) {
                writer.write("constructor(");
                if (overload.params.length > 0) {
                    writer.writeJoined(", ", overload.params);
                }
                writer.write(")");
                writer.writeLine(";");
            }
        }

        writer.write("constructor(");
        if (this.opts.params && this.opts.params.length > 0) {
            writer.writeJoined(", ", this.opts.params);
        }
        writer.write(") ");
        writeBody(writer, this.opts.body);
        writer.newLine();
    }
}

/** Create a {@link ConstructorBuilder} with the given options. */
export function constructorDecl(opts: ConstructorOptions): ConstructorBuilder {
    return new ConstructorBuilder(opts);
}
