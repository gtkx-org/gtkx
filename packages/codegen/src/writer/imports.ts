import { sortStrings, sortStringsBy, sourceStringLiteral } from "@gtkx/utils";

type NamespaceImport = {
    alias: string;
    isType: boolean;
};

type NamedImport = {
    name: string;
    isType: boolean;
};

export class ImportsBuilder {
    private named = new Map<string, Map<string, NamedImport>>();
    private namespaces = new Map<string, NamespaceImport>();
    private sideEffects = new Set<string>();

    addNamed(specifier: string, name: string, isType = false, alias?: string): void {
        const local = alias ?? name;
        let bucket = this.named.get(specifier);
        if (bucket === undefined) {
            bucket = new Map();
            this.named.set(specifier, bucket);
        }
        const existing = bucket.get(local);
        bucket.set(local, { name, isType: (existing?.isType ?? true) && isType });
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
        for (const specifier of sortStrings(specifiers)) {
            const line = this.specifierLine(specifier);
            if (line !== undefined) lines.push(line);
        }
        return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
    }

    private specifierLine(specifier: string): string | undefined {
        const namespaceImport = this.namespaces.get(specifier);
        const namedNames = this.named.get(specifier);
        if (namespaceImport?.isType === true) {
            return `import type * as ${namespaceImport.alias} from ${sourceStringLiteral(specifier)};`;
        }
        const parts: string[] = [];
        if (namespaceImport !== undefined) parts.push(`* as ${namespaceImport.alias}`);
        if (namedNames !== undefined && namedNames.size > 0) {
            parts.push(`{ ${formatNamedNames(namedNames).join(", ")} }`);
        }
        if (parts.length === 0) return undefined;
        return `import ${parts.join(", ")} from ${sourceStringLiteral(specifier)};`;
    }
}

function formatNamedNames(namedNames: Map<string, NamedImport>): string[] {
    return sortStringsBy(namedNames.entries(), ([local]) => local).map(([local, entry]) => {
        const spec = entry.name === local ? entry.name : `${entry.name} as ${local}`;
        return entry.isType ? `type ${spec}` : spec;
    });
}
