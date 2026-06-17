import { ImportsBuilder } from "./imports.js";

/**
 * Accumulator for one generated TypeScript module's source.
 *
 * Writers append code in three logical phases, stitched in this output order:
 *
 * 1. *Declarations* — the class bodies, free function exports, enums,
 *    constants.
 * 2. *Bindings* — the `const fn_name = t.fn(...)` block. It follows the
 *    declarations so a binding's `wrapperClass` can name a wrapper class by
 *    direct reference; the classes' own method bodies reach back to the
 *    bindings only when invoked, after the module has fully loaded.
 * 3. *Registrations* — the trailing block of module-load side-effect
 *    statements: `registerWrapperClass(...)` registrations plus namespace
 *    `init()` / `finalize` bootstrap calls.
 *
 * Keeping the three buckets independent removes ordering constraints
 * between writers and lets {@link toSource} stitch a final source string with
 * the same shape every generated file uses.
 */
export class ModuleBuilder {
    /** Imports manifest the writers feed into. */
    public readonly imports: ImportsBuilder = new ImportsBuilder();
    private readonly bindings: string[] = [];
    private readonly bindingNames = new Set<string>();
    private readonly hoistedFfiTypes = new Map<string, string>();
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
     * Hoists an FFI type-descriptor expression to a deduplicated module-level
     * `const`, returning its identifier. Lets a per-call wrapping site reference
     * a descriptor built once at module load rather than re-allocating it on
     * every call — e.g. a signal handler's argument wrappers, which run on every
     * emission. Identical expressions share one binding.
     *
     * @param expression - The `t.*` descriptor expression to hoist
     * @returns The identifier of the hoisted binding
     */
    hoistFfiType(expression: string): string {
        const existing = this.hoistedFfiTypes.get(expression);
        if (existing !== undefined) return existing;
        const name = `_ffi${this.hoistedFfiTypes.size}`;
        this.hoistedFfiTypes.set(expression, name);
        this.appendBinding(`const ${name} = ${expression};`, name);
        return name;
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
     * Appends a trailing module-load side-effect statement: a
     * `registerWrapperClass(…)` registration or a namespace `init()` /
     * `finalize` bootstrap call.
     *
     * @param code - The source fragment, without a trailing newline
     */
    appendRegistration(code: string): void {
        this.registrations.push(code);
    }

    /**
     * Renders the full TypeScript source: imports, declarations, bindings,
     * registrations — separated by a single blank line.
     */
    toSource(): string {
        const sections: string[] = [];
        const importsBlock = this.imports.toSource();
        if (importsBlock.length > 0) sections.push(importsBlock.trimEnd());
        if (this.declarations.length > 0) sections.push(this.declarations.join("\n\n"));
        if (this.bindings.length > 0) sections.push(this.bindings.join("\n\n"));
        if (this.registrations.length > 0) sections.push(this.registrations.join("\n\n"));
        return `${sections.join("\n\n")}\n`;
    }
}
