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

export class UsedSymbols {
    private named: NamedSymbol[] = [];
    private namespaces: NamespaceSymbol[] = [];
    private sideEffects = new Set<string>();

    recordNamed(specifier: string, name: string, isType = false): void {
        this.named.push({ specifier, name, isType });
    }

    recordNamespace(specifier: string, alias: string): void {
        this.namespaces.push({ specifier, alias });
    }

    recordSideEffect(specifier: string): void {
        this.sideEffects.add(specifier);
    }

    flushInto(imports: ImportsBuilder): void {
        for (const specifier of this.sideEffects) imports.addSideEffect(specifier);
        for (const entry of this.namespaces) imports.addNamespace(entry.specifier, entry.alias);
        for (const entry of this.named) imports.addNamed(entry.specifier, entry.name, entry.isType);
    }
}
