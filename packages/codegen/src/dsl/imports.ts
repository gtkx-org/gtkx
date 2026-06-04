import { quote } from "@gtkx/utils";

/**
 * Tracks imports for a single generated module.
 *
 * The DSL is intentionally tiny: it covers what is awkward to do with
 * string concatenation (deduplicating named imports, sorting them, mixing
 * side-effect and named imports from the same specifier) and leaves
 * everything else to raw TS strings the writers compose themselves.
 */
export class ImportsBuilder {
    private readonly named = new Map<string, Map<string, boolean>>();
    private readonly namespaces = new Map<string, string>();
    private readonly sideEffects = new Set<string>();

    /**
     * Records a named import: `import { foo, bar } from "lib"`.
     *
     * Repeated calls deduplicate; the final emit alphabetises within the
     * braces. A name is emitted with the inline `type` modifier only when
     * every recording of it is type-only — a single value import of the same
     * name keeps it a value import.
     *
     * @param specifier - The module specifier (e.g. `"@gtkx/ffi"`)
     * @param name - The identifier to import
     * @param isType - Whether this recording is type-only (`import { type X }`)
     */
    addNamed(specifier: string, name: string, isType = false): void {
        let bucket = this.named.get(specifier);
        if (bucket === undefined) {
            bucket = new Map();
            this.named.set(specifier, bucket);
        }
        bucket.set(name, (bucket.get(name) ?? true) && isType);
    }

    /**
     * Records a namespace import: `import * as Alias from "lib"`.
     *
     * The first call wins if a different alias is reused for the same
     * specifier.
     *
     * @param specifier - The module specifier
     * @param alias - The local alias bound by the import
     */
    addNamespace(specifier: string, alias: string): void {
        if (!this.namespaces.has(specifier)) {
            this.namespaces.set(specifier, alias);
        }
    }

    /**
     * Records a side-effect-only import: `import "lib"`.
     *
     * @param specifier - The module specifier
     */
    addSideEffect(specifier: string): void {
        this.sideEffects.add(specifier);
    }

    /**
     * Renders all imports as a single string ending with a trailing
     * newline. Side-effect imports come first (in insertion order),
     * followed by named/namespace/default imports sorted by specifier.
     */
    toSource(): string {
        const lines: string[] = [];
        for (const specifier of this.sideEffects) {
            lines.push(`import ${quote(specifier)};`);
        }
        const specifiers = new Set<string>([...this.named.keys(), ...this.namespaces.keys()]);
        const sortedSpecifiers = [...specifiers].sort((a, b) => a.localeCompare(b));
        for (const specifier of sortedSpecifiers) {
            const namespaceAlias = this.namespaces.get(specifier);
            const namedNames = this.named.get(specifier);
            const parts: string[] = [];
            if (namespaceAlias !== undefined) parts.push(`* as ${namespaceAlias}`);
            if (namedNames !== undefined && namedNames.size > 0) {
                const sortedNames = [...namedNames.entries()]
                    .sort(([a], [b]) => a.localeCompare(b))
                    .map(([name, isType]) => (isType ? `type ${name}` : name));
                parts.push(`{ ${sortedNames.join(", ")} }`);
            }
            if (parts.length === 0) continue;
            lines.push(`import ${parts.join(", ")} from ${quote(specifier)};`);
        }
        return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
    }
}
