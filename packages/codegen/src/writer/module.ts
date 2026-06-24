import { ImportsBuilder } from "./imports.js";

export class ModuleBuilder {
    public imports: ImportsBuilder = new ImportsBuilder();
    private bindings: string[] = [];
    private bindingNames = new Set<string>();
    private hoistedFfiTypes = new Map<string, string>();
    private declarations: string[] = [];
    private registrations: string[] = [];

    appendBinding(code: string, name?: string): void {
        if (name !== undefined) {
            if (this.bindingNames.has(name)) return;
            this.bindingNames.add(name);
        }
        this.bindings.push(code);
    }

    hoistFfiType(expression: string): string {
        const existing = this.hoistedFfiTypes.get(expression);
        if (existing !== undefined) return existing;
        const name = `_ffi${this.hoistedFfiTypes.size}`;
        this.hoistedFfiTypes.set(expression, name);
        this.appendBinding(`const ${name} = ${expression};`, name);
        return name;
    }

    appendDeclaration(code: string): void {
        this.declarations.push(code);
    }

    appendRegistration(code: string): void {
        this.registrations.push(code);
    }

    toSource(): string {
        const sections: string[] = [];
        const importsBlock = this.imports.toSource();
        if (importsBlock.length > 0) sections.push(importsBlock.trimEnd());
        if (this.declarations.length > 0) sections.push(this.declarations.join("\n\n"));
        if (this.bindings.length > 0) sections.push(this.bindings.join("\n\n"));
        if (this.registrations.length > 0) sections.push(this.registrations.join("\n\n"));
        return `${sections.join("\n\n")}\n`;
    }
}
