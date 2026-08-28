import { pure } from "./emit.js";
import { ImportsBuilder } from "./imports.js";

type Declaration = {
    name: string;
    code: string;
    owner?: string | undefined;
    isLocal?: boolean | undefined;
};

type ExportedDeclaration = {
    name: string;
    spaces: string[];
};

const EXPORTED_DECLARATION = /^export (?:abstract )?(class|const|enum|function|interface|type) ([A-Za-z_$][\w$]*)/mu;

const SPACES_BY_KEYWORD: Map<string, string[]> = new Map([
    ["class", ["value", "type"]],
    ["const", ["value"]],
    ["enum", ["value", "type"]],
    ["function", ["value"]],
    ["interface", []],
    ["type", ["type"]],
]);

const getExportedDeclaration = (code: string): ExportedDeclaration | undefined => {
    const match = EXPORTED_DECLARATION.exec(code);
    const spaces = SPACES_BY_KEYWORD.get(match?.[1] ?? "");
    const name = match?.[2];

    return spaces === undefined || name === undefined ? undefined : { name, spaces };
};

const exportedNameText = (exported: ExportedDeclaration | undefined): string =>
    exported === undefined ? "no name at all" : `'${exported.name}'`;

class ModuleBuilder {
    private bindings: string[] = [];
    private bindingNames: Set<string> = new Set();
    private hoistedDescriptors: Map<string, string> = new Map();
    private claimedSpaces: Set<string> = new Set();
    private declarations: string[] = [];
    private declaredNames: Set<string> = new Set();
    private declaredTypes: Map<string, string> = new Map();
    private registrations: string[] = [];
    private requiredNames: Set<string> = new Set();
    public imports: ImportsBuilder = new ImportsBuilder();

    private claimSpace(name: string, space: string): void {
        const key = `${space} ${name}`;

        if (this.claimedSpaces.has(key)) {
            throw new Error(
                `The generated module declares '${name}' twice in its ${space} space. ` +
                "A module may declare each exported name once per declaration space.",
            );
        }

        this.claimedSpaces.add(key);
    }

    private claimExportedName(declaration: Declaration): void {
        const exported = getExportedDeclaration(declaration.code);
        const spaces = exported?.name === declaration.name ? exported.spaces : undefined;

        if (spaces === undefined) {
            throw new Error(
                `The declaration recorded as '${declaration.name}' exports ${exportedNameText(exported)}. ` +
                "A declaration may only be recorded under the name its own code exports.",
            );
        }

        for (const space of spaces) {
            this.claimSpace(declaration.name, space);
        }
    }

    private claimTypeName(declaration: Declaration): void {
        const { name, owner } = declaration;

        if (owner === undefined) {
            return;
        }

        const previous = this.declaredTypes.get(name);

        if (previous !== undefined && previous !== owner) {
            throw new Error(
                `The generated type '${name}' is declared for both ${previous} and ${owner}. ` +
                "Rename one of them, or drop the namespace from the configuration.",
            );
        }

        this.declaredTypes.set(name, owner);
    }

    private verifyRegistrations(): void {
        const missing = [...this.requiredNames].filter((name) => !this.declaredNames.has(name));

        if (missing.length === 0) {
            return;
        }

        throw new Error(
            `The generated module registers ${missing.join(", ")}, which it never declares. ` +
            "A registration may only name a symbol whose declaration the same module emits.",
        );
    }

    appendBinding(code: string, name?: string): void {
        if (name !== undefined) {
            if (this.bindingNames.has(name)) {
                return;
            }

            this.bindingNames.add(name);
        }

        this.bindings.push(code);
    }

    hoistDescriptor(expression: string): string {
        const existing = this.hoistedDescriptors.get(expression);

        if (existing !== undefined) {
            return existing;
        }

        const name = `_desc${String(this.hoistedDescriptors.size)}`;
        this.hoistedDescriptors.set(expression, name);
        this.appendBinding(`const ${name} = ${pure(expression)};`, name);

        return name;
    }

    appendDeclaration(declaration: Declaration): void {
        if (declaration.isLocal === true) {
            this.declarations.push(declaration.code);

            return;
        }

        this.claimExportedName(declaration);
        this.claimTypeName(declaration);
        this.declaredNames.add(declaration.name);
        this.declarations.push(declaration.code);
    }

    hasExports(): boolean {
        return this.declaredNames.size > 0;
    }

    appendRegistration(code: string, requires: string[] = []): void {
        for (const name of requires) {
            this.requiredNames.add(name);
        }

        this.registrations.push(code);
    }

    toSource(): string {
        this.verifyRegistrations();
        const sections: string[] = [];
        const importsBlock = this.imports.toSource();

        if (importsBlock.length > 0) {
            sections.push(importsBlock.trimEnd());
        }

        if (this.declarations.length > 0) {
            sections.push(this.declarations.join("\n\n"));
        }

        if (this.bindings.length > 0) {
            sections.push(this.bindings.join("\n\n"));
        }

        if (this.registrations.length > 0) {
            sections.push(this.registrations.join("\n\n"));
        }

        return `${sections.join("\n\n")}\n`;
    }
}

export { type Declaration, ModuleBuilder };
