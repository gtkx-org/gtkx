import type { AccessorBuilder } from "../members/accessor.js";
import type { ConstructorBuilder } from "../members/constructor.js";
import { writeJsDoc } from "../members/doc.js";
import type { MethodBuilder } from "../members/method.js";
import type { PropertyBuilder } from "../members/property.js";
import type { Builder } from "../types.js";
import type { Writer } from "../writer.js";

/** Configuration options for a class declaration. */
export type ClassOptions = {
    exported?: boolean;
    extends?: string;
    abstract?: boolean;
    doc?: string;
};

/** Builder that emits a class declaration with properties, constructor, and methods. */
export class ClassDeclarationBuilder implements Builder {
    private readonly properties: PropertyBuilder[] = [];
    private readonly accessors: AccessorBuilder[] = [];
    private readonly methods: MethodBuilder[] = [];
    private ctor: ConstructorBuilder | null = null;
    private exported: boolean;

    constructor(
        readonly name: string,
        private readonly opts: ClassOptions = {},
    ) {
        this.exported = opts.exported ?? false;
    }

    /** Mark this class as exported. */
    export(): this {
        this.exported = true;
        return this;
    }

    /** Set the class constructor. */
    setConstructor(ctor: ConstructorBuilder): this {
        this.ctor = ctor;
        return this;
    }

    /** Add a property to the class body. */
    addProperty(prop: PropertyBuilder): this {
        this.properties.push(prop);
        return this;
    }

    /** Add an ES6 get/set accessor to the class body. */
    addAccessor(a: AccessorBuilder): this {
        this.accessors.push(a);
        return this;
    }

    /** Add a method to the class body. */
    addMethod(m: MethodBuilder): this {
        this.methods.push(m);
        return this;
    }

    /** @inheritdoc */
    write(writer: Writer): void {
        writeJsDoc(writer, this.opts.doc);
        if (this.exported) writer.write("export ");
        if (this.opts.abstract) writer.write("abstract ");
        writer.write(`class ${this.name}`);
        if (this.opts.extends) {
            writer.write(` extends ${this.opts.extends}`);
        }
        writer.write(" ");
        writer.writeBlock(() => {
            for (const prop of this.properties) {
                prop.write(writer);
            }

            const hasMembers = this.accessors.length > 0 || this.ctor || this.methods.length > 0;
            if (this.properties.length > 0 && hasMembers) {
                writer.newLine();
            }

            if (this.ctor) {
                this.ctor.write(writer);
            }

            for (const a of this.accessors) {
                a.write(writer);
            }

            for (const m of this.methods) {
                m.write(writer);
            }
        });
        writer.newLine();
    }
}

/** Create a {@link ClassDeclarationBuilder} with the given name and options. */
export function classDecl(name: string, opts?: ClassOptions): ClassDeclarationBuilder {
    return new ClassDeclarationBuilder(name, opts);
}
