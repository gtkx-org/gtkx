import type { ImportsBuilder } from "./imports.js";

type NamedSymbol = {
    specifier: string;
    name: string;
    isType: boolean;
};

type NamespaceSymbol = {
    specifier: string;
    alias: string;
};

/**
 * A neutral side channel recording the imports a module's render pass referenced.
 *
 * Render code records what it used here rather than mutating an
 * {@link ImportsBuilder} inline, so type rendering stays decoupled from import
 * bookkeeping. A single post-render {@link UsedSymbols.flushInto} pass resolves
 * the recorded symbols into the builder, mirroring a `used_types` collector
 * feeding a separate import emitter.
 */
export class UsedSymbols {
    private named: NamedSymbol[] = [];
    private namespaces: NamespaceSymbol[] = [];
    private sideEffects = new Set<string>();

    /**
     * Records a named import from a module specifier.
     *
     * @param specifier - The module specifier to import from.
     * @param name - The imported binding name.
     * @param isType - Whether the import is type-only.
     */
    recordNamed(specifier: string, name: string, isType = false): void {
        this.named.push({ specifier, name, isType });
    }

    /**
     * Records a namespace (`* as alias`) import from a module specifier.
     *
     * @param specifier - The module specifier to import from.
     * @param alias - The namespace alias bound locally.
     */
    recordNamespace(specifier: string, alias: string): void {
        this.namespaces.push({ specifier, alias });
    }

    /**
     * Records a side-effect-only import of a module specifier.
     *
     * @param specifier - The module specifier imported for its side effects.
     */
    recordSideEffect(specifier: string): void {
        this.sideEffects.add(specifier);
    }

    /**
     * Resolves every recorded symbol into the given imports builder in one pass.
     *
     * @param imports - The builder receiving the recorded import lines.
     */
    flushInto(imports: ImportsBuilder): void {
        for (const specifier of this.sideEffects) imports.addSideEffect(specifier);
        for (const entry of this.namespaces) imports.addNamespace(entry.specifier, entry.alias);
        for (const entry of this.named) imports.addNamed(entry.specifier, entry.name, entry.isType);
    }
}
