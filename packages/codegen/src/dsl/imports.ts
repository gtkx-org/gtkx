import { quote, sortedAlpha, sortedAlphaBy } from "@gtkx/utils";

export class ImportsBuilder {
    private named = new Map<string, Map<string, boolean>>();
    private namespaces = new Map<string, string>();
    private sideEffects = new Set<string>();

    addNamed(specifier: string, name: string, isType = false): void {
        let bucket = this.named.get(specifier);
        if (bucket === undefined) {
            bucket = new Map();
            this.named.set(specifier, bucket);
        }
        bucket.set(name, (bucket.get(name) ?? true) && isType);
    }

    addNamespace(specifier: string, alias: string): void {
        if (!this.namespaces.has(specifier)) {
            this.namespaces.set(specifier, alias);
        }
    }

    addSideEffect(specifier: string): void {
        this.sideEffects.add(specifier);
    }

    toSource(): string {
        const lines: string[] = [];
        for (const specifier of this.sideEffects) {
            lines.push(`import ${quote(specifier)};`);
        }
        const specifiers = new Set<string>([...this.named.keys(), ...this.namespaces.keys()]);
        const sortedSpecifiers = sortedAlpha(specifiers);
        for (const specifier of sortedSpecifiers) {
            const namespaceAlias = this.namespaces.get(specifier);
            const namedNames = this.named.get(specifier);
            const parts: string[] = [];
            if (namespaceAlias !== undefined) parts.push(`* as ${namespaceAlias}`);
            if (namedNames !== undefined && namedNames.size > 0) {
                const sortedNames = sortedAlphaBy(namedNames.entries(), ([name]) => name).map(([name, isType]) =>
                    isType ? `type ${name}` : name,
                );
                parts.push(`{ ${sortedNames.join(", ")} }`);
            }
            if (parts.length === 0) continue;
            lines.push(`import ${parts.join(", ")} from ${quote(specifier)};`);
        }
        return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
    }
}
