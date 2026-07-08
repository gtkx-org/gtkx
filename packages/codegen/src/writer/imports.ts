import { sortStrings, sortStringsBy, sourceStringLiteral } from "@gtkx/utils";

type NamespaceImport = {
    alias: string;
    isType: boolean;
};

export class ImportsBuilder {
    private named = new Map<string, Map<string, boolean>>();
    private namespaces = new Map<string, NamespaceImport>();
    private sideEffects = new Set<string>();

    addNamed(specifier: string, name: string, isType = false): void {
        let bucket = this.named.get(specifier);
        if (bucket === undefined) {
            bucket = new Map();
            this.named.set(specifier, bucket);
        }
        bucket.set(name, (bucket.get(name) ?? true) && isType);
    }

    addNamespace(specifier: string, alias: string, isType = false): void {
        if (!this.namespaces.has(specifier)) {
            this.namespaces.set(specifier, { alias, isType });
        }
    }

    addSideEffect(specifier: string): void {
        this.sideEffects.add(specifier);
    }

    toSource(): string {
        const lines: string[] = [];
        for (const specifier of this.sideEffects) {
            lines.push(`import ${sourceStringLiteral(specifier)};`);
        }
        const specifiers = new Set<string>([...this.named.keys(), ...this.namespaces.keys()]);
        const sortedSpecifiers = sortStrings(specifiers);
        for (const specifier of sortedSpecifiers) {
            const namespaceImport = this.namespaces.get(specifier);
            const namedNames = this.named.get(specifier);
            if (namespaceImport?.isType === true) {
                lines.push(`import type * as ${namespaceImport.alias} from ${sourceStringLiteral(specifier)};`);
                continue;
            }
            const parts: string[] = [];
            if (namespaceImport !== undefined) parts.push(`* as ${namespaceImport.alias}`);
            if (namedNames !== undefined && namedNames.size > 0) {
                const sortedNames = sortStringsBy(namedNames.entries(), ([name]) => name).map(([name, isType]) =>
                    isType ? `type ${name}` : name,
                );
                parts.push(`{ ${sortedNames.join(", ")} }`);
            }
            if (parts.length === 0) continue;
            lines.push(`import ${parts.join(", ")} from ${sourceStringLiteral(specifier)};`);
        }
        return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
    }
}
