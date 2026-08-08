import { ImportsBuilder } from "./imports.js";

type DeclaredType = {
    name: string;
    owner: string;
};

class ModuleBuilder {
    private bindings: string[] = [];
    private bindingNames: Set<string> = new Set();
    private hoistedDescriptors: Map<string, string> = new Map();
    private declarations: string[] = [];
    private declaredTypes: Map<string, string> = new Map();
    private registrations: string[] = [];
    public imports: ImportsBuilder = new ImportsBuilder();

    private claimTypeName(declared: DeclaredType): void {
        const owner = this.declaredTypes.get(declared.name);

        if (owner !== undefined && owner !== declared.owner) {
            throw new Error(
                `The generated type '${declared.name}' is declared for both ${owner} and ${declared.owner}. ` +
                "Rename one of them, or drop the namespace from the configuration.",
            );
        }

        this.declaredTypes.set(declared.name, declared.owner);
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
        this.appendBinding(`const ${name} = ${expression};`, name);

        return name;
    }

    appendDeclaration(code: string, declared?: DeclaredType): void {
        if (declared !== undefined) {
            this.claimTypeName(declared);
        }

        this.declarations.push(code);
    }

    appendRegistration(code: string): void {
        this.registrations.push(code);
    }

    toSource(): string {
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

export { type DeclaredType, ModuleBuilder };
