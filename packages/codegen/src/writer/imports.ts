import { sortStrings, sortStringsBy, sourceStringLiteral } from "@gtkx/utils";

type NamespaceImport = {
    alias: string;
    isType: boolean;
};

type NamedImport = {
    name: string;
    isType: boolean;
};

function formatNamedNames(namedNames: Map<string, NamedImport>): string[] {
    return sortStringsBy(namedNames.entries(), ([local]) => local).map(([local, entry]) => {
        const spec = entry.name === local ? entry.name : `${entry.name} as ${local}`;

        return entry.isType ? `type ${spec}` : spec;
    });
}

class ImportsBuilder {
    private named: Map<string, Map<string, NamedImport>> = new Map();
    private namespaces: Map<string, NamespaceImport> = new Map();
    private sideEffects: Set<string> = new Set();

    private specifierLines(specifier: string): string[] {
        const namespaceImport = this.namespaces.get(specifier);
        const namedNames = this.named.get(specifier);
        const source = sourceStringLiteral(specifier);
        const lines: string[] = [];

        if (namespaceImport !== undefined) {
            const prefix = namespaceImport.isType ? "import type" : "import";
            lines.push(`${prefix} * as ${namespaceImport.alias} from ${source};`);
        }

        if (namedNames !== undefined) {
            lines.push(`import { ${formatNamedNames(namedNames).join(", ")} } from ${source};`);
        }

        return lines;
    }

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
        const existing = this.namespaces.get(specifier);

        if (existing === undefined) {
            this.namespaces.set(specifier, { alias, isType });

            return;
        }

        if (!isType && existing.isType) {
            existing.isType = false;
        }
    }

    addSideEffect(specifier: string): void {
        this.sideEffects.add(specifier);
    }

    toSource(): string {
        const lines: string[] = Array.from(
            this.sideEffects,
            (specifier) => `import ${sourceStringLiteral(specifier)};`,
        );

        const specifiers: Set<string> = new Set([...this.named.keys(), ...this.namespaces.keys()]);

        for (const specifier of sortStrings(specifiers)) {
            lines.push(...this.specifierLines(specifier));
        }

        return lines.length === 0 ? "" : `${lines.join("\n")}\n`;
    }
}

export { ImportsBuilder };
