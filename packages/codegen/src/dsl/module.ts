import { ImportsBuilder } from "./imports.js";

/**
 * Accumulator for one generated TypeScript module's source.
 *
 * Writers append code in three logical phases:
 *
 * 1. *Bindings* — the `const fn_name = t.fn(...)` block at the top.
 * 2. *Declarations* — the class bodies, free function exports, enums,
 *    constants.
 * 3. *Registrations* — the trailing `registerNativeClass(...)` block.
 *
 * Keeping the three buckets independent removes ordering constraints
 * between writers and lets {@link emit} stitch a final source string with
 * the same shape every generated file uses today.
 */
export class ModuleBuilder {
    /** Imports manifest the writers feed into. */
    public readonly imports = new ImportsBuilder();
    private readonly bindings: string[] = [];
    private readonly bindingNames = new Set<string>();
    private readonly declarations: string[] = [];
    private readonly registrations: string[] = [];

    /**
     * Appends a top-level FFI binding (`const foo = t.fn(...)`).
     *
     * Duplicates are dropped when a `name` is supplied that matches a
     * previously appended binding; this is the common case for GIR
     * callables that appear both as a namespace function and as a
     * constructor or static on a class.
     *
     * @param code - The source fragment, without a trailing newline
     * @param name - Optional binding identifier used for deduplication
     */
    appendBinding(code: string, name?: string): void {
        if (name !== undefined) {
            if (this.bindingNames.has(name)) return;
            this.bindingNames.add(name);
        }
        this.bindings.push(code);
    }

    /**
     * Appends a declaration (class, function, enum, constant).
     *
     * @param code - The source fragment, without a trailing newline
     */
    appendDeclaration(code: string): void {
        this.declarations.push(code);
    }

    /**
     * Appends a trailing registration statement (`registerNativeClass(…)`).
     *
     * @param code - The source fragment, without a trailing newline
     */
    appendRegistration(code: string): void {
        this.registrations.push(code);
    }

    /**
     * Renders the full TypeScript source: imports, bindings, declarations,
     * registrations — separated by a single blank line.
     */
    toSource(): string {
        const sections: string[] = [];
        const importsBlock = this.imports.toSource();
        if (importsBlock.length > 0) sections.push(importsBlock.trimEnd());
        if (this.bindings.length > 0) sections.push(this.bindings.join("\n\n"));
        if (this.declarations.length > 0) sections.push(this.declarations.join("\n\n"));
        if (this.registrations.length > 0) sections.push(this.registrations.join("\n\n"));
        return `${sections.join("\n\n")}\n`;
    }
}
