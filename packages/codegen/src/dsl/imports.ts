import { quote } from "@gtkx/utils";

/**
 * Tracks imports for a single generated module.
 *
 * The DSL is intentionally tiny: it covers what is awkward to do with
 * string concatenation (deduplicating named imports, sorting them, mixing
 * side-effect and named imports from the same specifier) and leaves
 * everything else to raw TS strings the writers compose themselves.
 */
export class ImportsManifest {
    private readonly named = new Map<string, Set<string>>();
    private readonly defaultNames = new Map<string, string>();
    private readonly namespaces = new Map<string, string>();
    private readonly sideEffects = new Set<string>();

    /**
     * Records a named import: `import { foo, bar } from "lib"`.
     *
     * Repeated calls deduplicate; the final emit alphabetises within the
     * braces.
     *
     * @param specifier - The module specifier (e.g. `"../../runtime.js"`)
     * @param name - The identifier to import
     */
    addNamed(specifier: string, name: string): void {
        let bucket = this.named.get(specifier);
        if (bucket === undefined) {
            bucket = new Set();
            this.named.set(specifier, bucket);
        }
        bucket.add(name);
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
     * Records a default import: `import Alias from "lib"`. Subsequent calls
     * with a different alias are ignored.
     *
     * @param specifier - The module specifier
     * @param alias - The local name bound to the default export
     */
    addDefault(specifier: string, alias: string): void {
        if (!this.defaultNames.has(specifier)) {
            this.defaultNames.set(specifier, alias);
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
    emit(): string {
        const lines: string[] = [];
        for (const specifier of this.sideEffects) {
            lines.push(`import ${quote(specifier)};`);
        }
        const specifiers = new Set<string>([
            ...this.named.keys(),
            ...this.namespaces.keys(),
            ...this.defaultNames.keys(),
        ]);
        const sortedSpecifiers = [...specifiers].sort((a, b) => a.localeCompare(b));
        for (const specifier of sortedSpecifiers) {
            const defaultAlias = this.defaultNames.get(specifier);
            const namespaceAlias = this.namespaces.get(specifier);
            const namedNames = this.named.get(specifier);
            const parts: string[] = [];
            if (defaultAlias !== undefined) parts.push(defaultAlias);
            if (namespaceAlias !== undefined) parts.push(`* as ${namespaceAlias}`);
            if (namedNames !== undefined && namedNames.size > 0) {
                const sortedNames = [...namedNames].sort((a, b) => a.localeCompare(b));
                parts.push(`{ ${sortedNames.join(", ")} }`);
            }
            if (parts.length === 0) continue;
            lines.push(`import ${parts.join(", ")} from ${quote(specifier)};`);
        }
        return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
    }
}
