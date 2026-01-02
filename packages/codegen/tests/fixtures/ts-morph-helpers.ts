import { type ClassDeclaration, ModuleKind, Project, ScriptTarget, type SourceFile } from "ts-morph";

export function createTestProject(): Project {
    return new Project({
        compilerOptions: {
            strict: true,
            target: ScriptTarget.ESNext,
            module: ModuleKind.ESNext,
        },
        useInMemoryFileSystem: true,
    });
}

export function createTestSourceFile(project: Project, name = "test.ts"): SourceFile {
    return project.createSourceFile(name, "", { overwrite: true });
}

export function getGeneratedCode(sourceFile: SourceFile): string {
    return sourceFile.getFullText();
}

export function assertClassExists(sourceFile: SourceFile, className: string): ClassDeclaration {
    const cls = sourceFile.getClass(className);
    if (!cls) {
        throw new Error(`Expected class "${className}" to exist in source file`);
    }
    return cls;
}

export function assertMethodExists(sourceFile: SourceFile, className: string, methodName: string): void {
    const cls = assertClassExists(sourceFile, className);
    const method = cls.getMethod(methodName);
    if (!method) {
        throw new Error(`Expected method "${methodName}" on class "${className}"`);
    }
}

export function assertPropertyExists(sourceFile: SourceFile, className: string, propertyName: string): void {
    const cls = assertClassExists(sourceFile, className);
    const prop = cls.getProperty(propertyName);
    if (!prop) {
        throw new Error(`Expected property "${propertyName}" on class "${className}"`);
    }
}

export function assertStaticPropertyExists(sourceFile: SourceFile, className: string, propertyName: string): void {
    const cls = assertClassExists(sourceFile, className);
    const prop = cls.getStaticProperty(propertyName);
    if (!prop) {
        throw new Error(`Expected static property "${propertyName}" on class "${className}"`);
    }
}

export function assertExportExists(sourceFile: SourceFile, exportName: string): void {
    const exportDecl = sourceFile.getExportedDeclarations().get(exportName);
    if (!exportDecl || exportDecl.length === 0) {
        throw new Error(`Expected export "${exportName}" to exist`);
    }
}

export function assertEnumExists(sourceFile: SourceFile, enumName: string): void {
    const enumDecl = sourceFile.getEnum(enumName);
    if (!enumDecl) {
        throw new Error(`Expected enum "${enumName}" to exist`);
    }
}

export function assertInterfaceExists(sourceFile: SourceFile, interfaceName: string): void {
    const iface = sourceFile.getInterface(interfaceName);
    if (!iface) {
        throw new Error(`Expected interface "${interfaceName}" to exist`);
    }
}

export function assertTypeAliasExists(sourceFile: SourceFile, typeName: string): void {
    const typeAlias = sourceFile.getTypeAlias(typeName);
    if (!typeAlias) {
        throw new Error(`Expected type alias "${typeName}" to exist`);
    }
}

export function assertFunctionExists(sourceFile: SourceFile, functionName: string): void {
    const func = sourceFile.getFunction(functionName);
    if (!func) {
        throw new Error(`Expected function "${functionName}" to exist`);
    }
}

export function assertVariableExists(sourceFile: SourceFile, variableName: string): void {
    const varDecl = sourceFile.getVariableDeclaration(variableName);
    if (!varDecl) {
        throw new Error(`Expected variable "${variableName}" to exist`);
    }
}

export function getClassMethodNames(sourceFile: SourceFile, className: string): string[] {
    const cls = assertClassExists(sourceFile, className);
    return cls.getMethods().map((m) => m.getName());
}

export function getClassPropertyNames(sourceFile: SourceFile, className: string): string[] {
    const cls = assertClassExists(sourceFile, className);
    return cls.getProperties().map((p) => p.getName());
}

export function getClassStaticPropertyNames(sourceFile: SourceFile, className: string): string[] {
    const cls = assertClassExists(sourceFile, className);
    return cls.getStaticProperties().map((p) => p.getName());
}

export function getEnumMemberNames(sourceFile: SourceFile, enumName: string): string[] {
    const enumDecl = sourceFile.getEnum(enumName);
    if (!enumDecl) {
        throw new Error(`Enum "${enumName}" not found`);
    }
    return enumDecl.getMembers().map((m) => m.getName());
}

export function hasImport(sourceFile: SourceFile, moduleSpecifier: string): boolean {
    return sourceFile.getImportDeclarations().some((imp) => imp.getModuleSpecifierValue() === moduleSpecifier);
}

export function getImportedNames(sourceFile: SourceFile, moduleSpecifier: string): string[] {
    const imp = sourceFile.getImportDeclarations().find((i) => i.getModuleSpecifierValue() === moduleSpecifier);
    if (!imp) return [];

    return imp.getNamedImports().map((n) => n.getName());
}

export function codeContains(sourceFile: SourceFile, substring: string): boolean {
    return getGeneratedCode(sourceFile).includes(substring);
}

export type FfiWidgetConfig = {
    namespace: string;
    className: string;
    isContainer?: boolean;
    slots?: string[];
};

export function createFfiProjectWithWidgets(widgets: FfiWidgetConfig[]): Project {
    const project = createTestProject();

    for (const widget of widgets) {
        const nsLower = widget.namespace.toLowerCase();
        const fileNameKebab = widget.className.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();
        const isContainer = widget.isContainer ?? false;
        const slots = widget.slots ?? [];
        const slotsStr = slots.length > 0 ? `[${slots.map((s) => `"${s}"`).join(", ")}] as const` : "[] as const";

        project.createSourceFile(
            `ffi/${nsLower}/${fileNameKebab}.ts`,
            `
            export class ${widget.className} {
                static readonly WIDGET_META = {
                    isContainer: ${isContainer},
                    slots: ${slotsStr},
                };
            }
        `,
        );
    }

    return project;
}

export function createFfiProjectWithWidget(
    namespace: string,
    className: string,
    config: Omit<FfiWidgetConfig, "namespace" | "className"> = {},
): Project {
    return createFfiProjectWithWidgets([{ namespace, className, ...config }]);
}
