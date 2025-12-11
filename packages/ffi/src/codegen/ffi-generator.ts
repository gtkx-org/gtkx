import type {
    ExternalTypeUsage,
    FfiTypeDescriptor,
    GirClass,
    GirConstructor,
    GirEnumeration,
    GirField,
    GirFunction,
    GirInterface,
    GirMethod,
    GirNamespace,
    GirParameter,
    GirRecord,
    GirSignal,
    TypeRegistry,
} from "@gtkx/gir";
import { TypeMapper, toCamelCase, toPascalCase } from "@gtkx/gir";
import { format } from "prettier";

/**
 * Configuration options for the FFI code generator.
 */
interface GeneratorOptions {
    /** Output directory for generated files. */
    outputDir: string;
    /** The namespace being generated (e.g., "Gtk"). */
    namespace: string;
    /** Optional Prettier configuration for formatting output. */
    prettierConfig?: unknown;
    /** Optional type registry for cross-namespace type resolution. */
    typeRegistry?: TypeRegistry;
}

const RESERVED_WORDS = new Set([
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "import",
    "in",
    "instanceof",
    "new",
    "null",
    "return",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "yield",
    "let",
    "static",
    "enum",
    "implements",
    "interface",
    "package",
    "private",
    "protected",
    "public",
    "await",
    "async",
    "eval",
    "arguments",
]);

const METHOD_RENAMES = new Map<string, Map<string, string>>([
    [
        "IconView",
        new Map([
            ["setCursor", "setCursorPath"],
            ["getCursor", "getCursorPath"],
        ]),
    ],
    [
        "TreeView",
        new Map([
            ["setCursor", "setCursorPath"],
            ["getCursor", "getCursorPath"],
        ]),
    ],
    ["HSV", new Map([["getColor", "getHsvColor"]])],
    ["Layout", new Map([["getSize", "getLayoutSize"]])],
    ["Table", new Map([["getSize", "getTableSize"]])],
    ["MenuItem", new Map([["activate", "activateItem"]])],
    ["FunctionInfo", new Map([["invoke", "invokeFunction"]])],
    ["VFuncInfo", new Map([["invoke", "invokeVFunc"]])],
    ["SignalGroup", new Map([["connect", "connectSignal"]])],
    [
        "MenuButton",
        new Map([
            ["getDirection", "getArrowDirection"],
            ["setDirection", "setArrowDirection"],
        ]),
    ],
    ["PrintUnixDialog", new Map([["getSettings", "getPrintSettings"]])],
    ["Gdk.AppLaunchContext", new Map([["getDisplay", "getGdkDisplay"]])],
    ["SocketClient", new Map([["connect", "connectTo"]])],
    ["SocketConnection", new Map([["connect", "connectTo"]])],
    ["Socket", new Map([["connect", "connectTo"]])],
    ["Cancellable", new Map([["connect", "connectCallback"]])],
    ["GutterRenderer", new Map([["activate", "activateRenderer"]])],
    ["GutterRendererText", new Map([["measure", "measureText"]])],
]);

const CLASS_RENAMES = new Map<string, string>([["Error", "GError"]]);

const getRenamedMethod = (namespace: string, className: string, methodName: string): string | undefined => {
    const nsRenames = METHOD_RENAMES.get(`${namespace}.${className}`);
    if (nsRenames?.has(methodName)) {
        return nsRenames.get(methodName);
    }
    const classRenames = METHOD_RENAMES.get(className);
    return classRenames?.get(methodName);
};

const toKebabCase = (str: string): string =>
    str
        .replace(/([a-z])([A-Z])/g, "$1-$2")
        .replace(/_/g, "-")
        .toLowerCase();

const toConstantCase = (str: string): string => str.replace(/-/g, "_").toUpperCase();

const sanitizeDoc = (doc: string): string => {
    let result = doc;
    result = result.replace(/<picture>[\s\S]*?<\/picture>/gi, "");
    result = result.replace(/<img[^>]*>/gi, "");
    result = result.replace(/<source[^>]*>/gi, "");
    result = result.replace(/!\[[^\]]*\]\([^)]+\.png\)/gi, "");
    result = result.replace(/<kbd>([^<]*)<\/kbd>/gi, "`$1`");
    result = result.replace(/<kbd>/gi, "`");
    result = result.replace(/<\/kbd>/gi, "`");
    result = result.replace(/\[([^\]]+)\]\([^)]+\.html[^)]*\)/gi, "$1");
    result = result.replace(/@(\w+)\s/g, "`$1` ");
    return result.trim();
};

const formatDoc = (doc: string | undefined, indent: string = ""): string => {
    if (!doc) return "";
    const sanitized = sanitizeDoc(doc);
    if (!sanitized) return "";
    const lines = sanitized.split("\n").map((line) => line.trim());
    const firstLine = lines[0] ?? "";
    if (lines.length === 1 && firstLine.length < 80) {
        return `${indent}/** ${firstLine} */\n`;
    }
    const formattedLines = lines.map((line) => `${indent} * ${line}`);
    return `${indent}/**\n${formattedLines.join("\n")}\n${indent} */\n`;
};

const formatMethodDoc = (doc: string | undefined, params: GirParameter[], indent: string = "  "): string => {
    const sanitizedDoc = doc ? sanitizeDoc(doc) : undefined;
    if (!sanitizedDoc && params.every((p) => !p.doc)) return "";
    const lines: string[] = [];
    if (sanitizedDoc) {
        for (const line of sanitizedDoc.split("\n")) {
            lines.push(` * ${line.trim()}`);
        }
    }
    for (const param of params) {
        if (param.doc && param.name && param.name !== "..." && param.name !== "") {
            const paramName = toValidIdentifier(toCamelCase(param.name));
            const sanitizedParamDoc = sanitizeDoc(param.doc);
            const paramDoc = sanitizedParamDoc.split("\n")[0]?.trim() ?? "";
            lines.push(` * @param ${paramName} - ${paramDoc}`);
        }
    }
    if (lines.length === 0) return "";
    return `${indent}/**\n${indent}${lines.join(`\n${indent}`)}\n${indent} */\n`;
};

const toValidIdentifier = (str: string): string => {
    let result = str.replace(/[^a-zA-Z0-9_$]/g, "_");
    if (RESERVED_WORDS.has(result)) result = `_${result}`;
    if (/^\d/.test(result)) result = `_${result}`;
    return result;
};

const normalizeClassName = (name: string): string => {
    const pascalName = toPascalCase(name);
    if (CLASS_RENAMES.has(pascalName)) {
        return CLASS_RENAMES.get(pascalName) as string;
    }
    if (pascalName === "Object") {
        return "GObject";
    }
    return pascalName;
};

type ParentInfo = {
    hasParent: boolean;
    isCrossNamespace: boolean;
    namespace?: string;
    className: string;
    importStatement?: string;
    extendsClause: string;
};

const parseParentReference = (parent: string | undefined, classMap: Map<string, GirClass>): ParentInfo => {
    if (!parent) {
        return { hasParent: false, isCrossNamespace: false, className: "", extendsClause: "" };
    }

    if (parent.includes(".")) {
        const [ns, className] = parent.split(".", 2);
        if (ns && className) {
            const normalizedClass = normalizeClassName(className);
            const nsLower = ns.toLowerCase();
            return {
                hasParent: true,
                isCrossNamespace: true,
                namespace: ns,
                className: normalizedClass,
                importStatement: `import * as ${ns} from "../${nsLower}/index.js";`,
                extendsClause: ` extends ${ns}.${normalizedClass}`,
            };
        }
    }

    if (classMap.has(parent)) {
        const normalizedClass = normalizeClassName(parent);
        return {
            hasParent: true,
            isCrossNamespace: false,
            className: normalizedClass,
            importStatement: `import { ${normalizedClass} } from "./${toKebabCase(parent)}.js";`,
            extendsClause: ` extends ${normalizedClass}`,
        };
    }

    return { hasParent: false, isCrossNamespace: false, className: "", extendsClause: "" };
};

const hasOutParameter = (params: GirParameter[]): boolean =>
    params.some((p) => p.direction === "out" || p.direction === "inout");

const isVararg = (param: GirParameter): boolean => param.name === "..." || param.name === "";

const cTypeToGetTypeFunc = (cType: string): string => {
    const snakeCase = cType.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase();
    return `${snakeCase}_get_type`;
};

/**
 * Generates TypeScript FFI bindings from GIR namespace definitions.
 * Creates classes, methods, properties, and signal handlers that call
 * native GTK functions through the FFI bridge.
 */
export class CodeGenerator {
    private typeMapper: TypeMapper;
    private usesRef = false;
    private usesCall = false;
    private addGioImport = false;
    private usesType = false;
    private usesRead = false;
    private usesWrite = false;
    private usesAlloc = false;
    private usesNativeError = false;
    private usesGetObject = false;
    private usesRegisterType = false;
    private usesSignalMeta = false;
    private usedEnums = new Set<string>();
    private usedRecords = new Set<string>();
    private usedExternalTypes = new Map<string, ExternalTypeUsage>();
    private usedSameNamespaceClasses = new Map<string, string>();
    private usedInterfaces = new Map<string, string>();
    private signalClasses = new Set<string>();
    private recordNameToFile = new Map<string, string>();
    private interfaceNameToFile = new Map<string, string>();
    private currentSharedLibrary = "";
    private cyclicReturnTypes = new Set<string>();

    /**
     * Creates a new code generator with the given options.
     * @param options - Generator configuration
     */
    constructor(private options: GeneratorOptions) {
        this.typeMapper = new TypeMapper();
        if (options.typeRegistry) {
            this.typeMapper.setTypeRegistry(options.typeRegistry, options.namespace);
        }
    }

    /**
     * Generates TypeScript files for all types in a GIR namespace.
     * @param namespace - The parsed GIR namespace
     * @returns Map of filename to generated TypeScript code
     */
    async generateNamespace(namespace: GirNamespace): Promise<Map<string, string>> {
        const files = new Map<string, string>();

        this.currentSharedLibrary = namespace.sharedLibrary;
        this.registerEnumsAndBitfields(namespace);
        this.registerRecords(namespace);
        this.registerInterfaces(namespace);
        const classMap = this.buildClassMap(namespace);
        const interfaceMap = this.buildInterfaceMap(namespace);

        const allEnums = [...namespace.enumerations, ...namespace.bitfields];
        if (allEnums.length > 0) {
            files.set("enums.ts", await this.generateEnums(allEnums));
        }

        for (const record of namespace.records) {
            if (this.shouldGenerateRecord(record)) {
                files.set(`${toKebabCase(record.name)}.ts`, await this.generateRecord(record, namespace.sharedLibrary));
            }
        }

        const sortedClasses = this.topologicalSortClasses(namespace.classes, classMap);
        for (const cls of sortedClasses) {
            files.set(
                `${toKebabCase(cls.name)}.ts`,
                await this.generateClass(cls, namespace.sharedLibrary, classMap, interfaceMap),
            );
        }

        for (const iface of namespace.interfaces) {
            files.set(
                `${toKebabCase(iface.name)}.ts`,
                await this.generateInterface(iface, namespace.sharedLibrary, classMap),
            );
        }

        const standaloneFunctions = this.getStandaloneFunctions(namespace);
        if (standaloneFunctions.length > 0) {
            files.set("functions.ts", await this.generateFunctions(standaloneFunctions, namespace.sharedLibrary));
        }

        files.set("index.ts", await this.generateIndex(files.keys()));

        return files;
    }

    private registerEnumsAndBitfields(namespace: GirNamespace): void {
        for (const enumeration of namespace.enumerations) {
            this.typeMapper.registerEnum(enumeration.name, toPascalCase(enumeration.name));
        }
        for (const bitfield of namespace.bitfields) {
            this.typeMapper.registerEnum(bitfield.name, toPascalCase(bitfield.name));
        }
    }

    private registerRecords(namespace: GirNamespace): void {
        for (const record of namespace.records) {
            if (this.shouldGenerateRecord(record)) {
                const normalizedName = normalizeClassName(record.name);
                this.typeMapper.registerRecord(record.name, normalizedName, record.glibTypeName);
                this.recordNameToFile.set(normalizedName, record.name);
            }
        }
    }

    private shouldGenerateRecord(record: GirRecord): boolean {
        if (record.disguised) return false;
        if (record.name.endsWith("Class")) return false;
        if (record.name.endsWith("Private")) return false;
        if (record.name.endsWith("Iface")) return false;
        if (!record.glibTypeName) return false;
        return true;
    }

    private buildClassMap(namespace: GirNamespace): Map<string, GirClass> {
        const classMap = new Map<string, GirClass>();
        for (const cls of namespace.classes) {
            classMap.set(cls.name, cls);
        }
        return classMap;
    }

    private registerInterfaces(namespace: GirNamespace): void {
        for (const iface of namespace.interfaces) {
            const normalizedName = toPascalCase(iface.name);
            this.interfaceNameToFile.set(normalizedName, iface.name);
        }
    }

    private buildInterfaceMap(namespace: GirNamespace): Map<string, GirInterface> {
        const interfaceMap = new Map<string, GirInterface>();
        for (const iface of namespace.interfaces) {
            interfaceMap.set(iface.name, iface);
        }
        return interfaceMap;
    }

    private getStandaloneFunctions(namespace: GirNamespace): GirFunction[] {
        return namespace.functions;
    }

    private resetState(): void {
        this.usesRef = false;
        this.usesCall = false;
        this.addGioImport = false;
        this.usesType = false;
        this.usesRead = false;
        this.usesWrite = false;
        this.usesAlloc = false;
        this.usesNativeError = false;
        this.usesGetObject = false;
        this.usesRegisterType = false;
        this.usesSignalMeta = false;
        this.usedEnums.clear();
        this.usedRecords.clear();
        this.usedExternalTypes.clear();
        this.usedSameNamespaceClasses.clear();
        this.usedInterfaces.clear();
        this.signalClasses.clear();
        this.cyclicReturnTypes.clear();
        this.typeMapper.setEnumUsageCallback((enumName) => this.usedEnums.add(enumName));
        this.typeMapper.setRecordUsageCallback((recordName) => this.usedRecords.add(recordName));
        this.typeMapper.setExternalTypeUsageCallback((usage) => {
            const key = `${usage.namespace}.${usage.transformedName}`;
            this.usedExternalTypes.set(key, usage);
        });
        this.typeMapper.setSameNamespaceClassUsageCallback((className, originalName) => {
            this.usedSameNamespaceClasses.set(className, originalName);
        });
    }

    private async generateClass(
        cls: GirClass,
        sharedLibrary: string,
        classMap: Map<string, GirClass>,
        interfaceMap: Map<string, GirInterface>,
    ): Promise<string> {
        this.resetState();
        this.cyclicReturnTypes = this.computeCyclicReturnTypes(cls, classMap);

        const asyncMethods = new Set<string>();
        const finishMethods = new Set<string>();
        for (const method of cls.methods) {
            if (this.hasAsyncCallback(method)) {
                asyncMethods.add(method.name);
                finishMethods.add(`${method.name}_finish`);
            }
        }

        const parentMethodNames = this.collectParentMethodNames(cls, classMap, interfaceMap);
        const filteredClassMethods = cls.methods.filter((m) => !parentMethodNames.has(m.name));
        const classMethodNames = new Set(cls.methods.map((m) => m.name));

        const interfaceMethods = cls.implements
            .flatMap((ifaceName) => interfaceMap.get(ifaceName)?.methods ?? [])
            .filter((m) => !classMethodNames.has(m.name) && !parentMethodNames.has(m.name));

        const syncMethods = filteredClassMethods.filter((m) => !asyncMethods.has(m.name) && !finishMethods.has(m.name));
        const syncInterfaceMethods = interfaceMethods.filter(
            (m) => !asyncMethods.has(m.name) && !finishMethods.has(m.name),
        );

        this.usesRef =
            syncMethods.some((m) => hasOutParameter(m.parameters)) ||
            cls.constructors.some((c) => hasOutParameter(c.parameters)) ||
            cls.functions.some((f) => hasOutParameter(f.parameters)) ||
            syncInterfaceMethods.some((m) => hasOutParameter(m.parameters));
        const hasNonVarargConstructor = cls.constructors.some((c) => !c.parameters.some(isVararg));
        const needsGObjectNewFallback = !hasNonVarargConstructor && !!cls.parent && !!cls.cType;
        this.usesCall =
            filteredClassMethods.length > 0 ||
            cls.constructors.length > 0 ||
            cls.functions.length > 0 ||
            cls.signals.length > 0 ||
            interfaceMethods.length > 0 ||
            needsGObjectNewFallback;

        const className = normalizeClassName(cls.name);
        const parentInfo = parseParentReference(cls.parent, classMap);

        const implementsClause = "";

        const sections: string[] = [];

        if (parentInfo.importStatement && !parentInfo.isCrossNamespace) {
            sections.push(parentInfo.importStatement);
        }
        sections.push("");

        if (cls.doc) {
            sections.push(formatDoc(cls.doc));
        }
        sections.push(`export class ${className}${parentInfo.extendsClause}${implementsClause} {`);

        if (cls.glibTypeName) {
            const override = parentInfo.hasParent ? "override " : "";
            sections.push(`  static ${override}readonly glibTypeName: string = "${cls.glibTypeName}";\n`);
        }

        if (!parentInfo.hasParent) {
            sections.push(`  id: unknown;\n`);
        }

        sections.push(this.generateConstructors(cls, sharedLibrary, parentInfo.hasParent));
        sections.push(this.generateCreatePtr(cls, sharedLibrary, parentInfo.hasParent));
        sections.push(this.generateStaticFunctions(cls.functions, sharedLibrary, className));
        sections.push(this.generateMethods(filteredClassMethods, sharedLibrary, cls.name));

        if (interfaceMethods.length > 0) {
            sections.push(this.generateMethods(interfaceMethods, sharedLibrary, className));
        }

        let signalMetaConstant = "";
        const { signals: allSignals, hasCrossNamespaceParent } = this.collectAllSignals(cls, classMap);
        if (allSignals.length > 0 || hasCrossNamespaceParent) {
            const hasConnectMethod = cls.methods.some((m) => toCamelCase(m.name) === "connect");
            const signalConnect = this.generateSignalConnect(
                sharedLibrary,
                allSignals,
                hasConnectMethod,
                classMap,
                className,
            );
            signalMetaConstant = signalConnect.moduleLevel;
            sections.push(signalConnect.method);
        }

        sections.push("}");

        if (cls.glibTypeName) {
            this.usesRegisterType = true;
            sections.push(`\nregisterType(${className});`);
        }

        if (signalMetaConstant) {
            const classDefIndex = sections.findIndex((s) => s.startsWith("export class "));
            if (classDefIndex !== -1) {
                sections.splice(classDefIndex, 0, signalMetaConstant);
            }
        }

        const imports = this.generateImports(
            className,
            parentInfo.hasParent && !parentInfo.isCrossNamespace ? parentInfo.className : undefined,
            parentInfo.isCrossNamespace ? parentInfo.namespace : undefined,
        );
        return this.formatCode(imports + sections.join("\n"));
    }

    private topologicalSortClasses(classes: GirClass[], classMap: Map<string, GirClass>): GirClass[] {
        const sorted: GirClass[] = [];
        const visited = new Set<string>();

        const visit = (cls: GirClass) => {
            if (visited.has(cls.name)) return;
            visited.add(cls.name);
            if (cls.parent && classMap.has(cls.parent)) {
                const parent = classMap.get(cls.parent) as GirClass;
                visit(parent);
            }
            sorted.push(cls);
        };

        for (const cls of classes) {
            visit(cls);
        }

        return sorted;
    }

    private isDescendantOf(className: string, ancestorName: string, classMap: Map<string, GirClass>): boolean {
        const cls = classMap.get(className);
        if (!cls) return false;
        if (cls.parent === ancestorName) return true;
        if (cls.parent && classMap.has(cls.parent)) {
            return this.isDescendantOf(cls.parent, ancestorName, classMap);
        }
        return false;
    }

    private computeCyclicReturnTypes(cls: GirClass, classMap: Map<string, GirClass>): Set<string> {
        const cyclic = new Set<string>();
        for (const method of cls.methods) {
            const returnTypeName = method.returnType.name;
            if (returnTypeName && classMap.has(returnTypeName)) {
                if (this.wouldCreateCycle(cls.name, returnTypeName, classMap)) {
                    cyclic.add(normalizeClassName(returnTypeName));
                }
            }
        }
        for (const func of cls.functions) {
            const returnTypeName = func.returnType.name;
            if (returnTypeName && classMap.has(returnTypeName)) {
                if (this.wouldCreateCycle(cls.name, returnTypeName, classMap)) {
                    cyclic.add(normalizeClassName(returnTypeName));
                }
            }
        }
        return cyclic;
    }

    private wouldCreateCycle(currentClass: string, returnType: string, classMap: Map<string, GirClass>): boolean {
        if (this.isDescendantOf(returnType, currentClass, classMap)) {
            return true;
        }
        const returnTypeClass = classMap.get(returnType);
        if (!returnTypeClass) return false;
        const ancestors = this.getAncestors(returnType, classMap);
        for (const ancestor of ancestors) {
            const ancestorClass = classMap.get(ancestor);
            if (!ancestorClass) continue;
            if (this.classImports(ancestorClass, currentClass, classMap)) {
                return true;
            }
        }
        return false;
    }

    private getAncestors(className: string, classMap: Map<string, GirClass>): string[] {
        const ancestors: string[] = [];
        let current = classMap.get(className);
        while (current?.parent && classMap.has(current.parent)) {
            ancestors.push(current.parent);
            current = classMap.get(current.parent);
        }
        return ancestors;
    }

    private classImports(cls: GirClass, targetClass: string, _classMap: Map<string, GirClass>): boolean {
        for (const method of cls.methods) {
            if (method.returnType.name === targetClass) return true;
            for (const param of method.parameters) {
                if (param.type.name === targetClass) return true;
            }
        }
        for (const func of cls.functions) {
            if (func.returnType.name === targetClass) return true;
            for (const param of func.parameters) {
                if (param.type.name === targetClass) return true;
            }
        }
        for (const prop of cls.properties) {
            if (prop.type.name === targetClass) return true;
        }
        return false;
    }

    private collectParentMethodNames(
        cls: GirClass,
        classMap: Map<string, GirClass>,
        interfaceMap: Map<string, GirInterface>,
    ): Set<string> {
        const names = new Set<string>();
        let current = cls.parent ? classMap.get(cls.parent) : undefined;
        while (current) {
            for (const method of current.methods) {
                names.add(method.name);
            }
            for (const ifaceName of current.implements) {
                const iface = interfaceMap.get(ifaceName);
                if (iface) {
                    for (const method of iface.methods) {
                        names.add(method.name);
                    }
                }
            }
            current = current.parent ? classMap.get(current.parent) : undefined;
        }
        return names;
    }

    private collectAllSignals(
        cls: GirClass,
        classMap: Map<string, GirClass>,
    ): { signals: GirSignal[]; hasCrossNamespaceParent: boolean } {
        const allSignals: GirSignal[] = [...cls.signals];
        const seenNames = new Set(cls.signals.map((s) => s.name));

        if (cls.parent?.includes(".")) {
            return { signals: allSignals, hasCrossNamespaceParent: true };
        }

        let current = cls.parent ? classMap.get(cls.parent) : undefined;
        while (current) {
            for (const signal of current.signals) {
                if (!seenNames.has(signal.name)) {
                    allSignals.push(signal);
                    seenNames.add(signal.name);
                }
            }

            if (current.parent?.includes(".")) {
                return { signals: allSignals, hasCrossNamespaceParent: true };
            }
            current = current.parent ? classMap.get(current.parent) : undefined;
        }
        return { signals: allSignals, hasCrossNamespaceParent: false };
    }

    private generateConstructors(cls: GirClass, _sharedLibrary: string, hasParent: boolean): string {
        const mainConstructor = cls.constructors.find((c) => !c.parameters.some(isVararg));
        const sections: string[] = [];

        if (mainConstructor) {
            sections.push(this.generateConstructor(mainConstructor, hasParent));
            for (const ctor of cls.constructors) {
                if (ctor !== mainConstructor) {
                    sections.push(this.generateStaticFactoryMethod(ctor, cls.name, _sharedLibrary));
                }
            }
        } else if (cls.constructors.length > 0) {
            for (const ctor of cls.constructors) {
                sections.push(this.generateStaticFactoryMethod(ctor, cls.name, _sharedLibrary));
            }
        }

        if (!mainConstructor) {
            if (hasParent) {
                sections.push(`  constructor(...args: unknown[]) {\n    super(...args);\n  }\n`);
            } else {
                sections.push(`  constructor(...args: unknown[]) {\n    this.id = this.createPtr(args);\n  }\n`);
            }
        }

        return sections.join("\n");
    }

    private generateConstructor(ctor: GirConstructor, hasParent: boolean): string {
        const ctorDoc = formatMethodDoc(ctor.doc, ctor.parameters);
        const filteredParams = ctor.parameters.filter((p) => !isVararg(p));

        if (filteredParams.length === 0) {
            if (hasParent) {
                return `${ctorDoc}  constructor(...args: unknown[]) {\n    super(...args);\n  }\n`;
            }
            return `${ctorDoc}  constructor(...args: unknown[]) {\n    this.id = this.createPtr(args);\n  }\n`;
        }

        const typedParams = this.generateParameterList(ctor.parameters, false);

        if (hasParent) {
            return `${ctorDoc}  constructor(${typedParams});
  constructor(...args: unknown[]);
  constructor(...args: unknown[]) {
    super(...args);
  }
`;
        }

        return `${ctorDoc}  constructor(${typedParams});
  constructor(...args: unknown[]);
  constructor(...args: unknown[]) {
    this.id = this.createPtr(args);
  }
`;
    }

    private generateCreatePtr(cls: GirClass, sharedLibrary: string, hasParent: boolean): string {
        const mainConstructor = cls.constructors.find((c) => !c.parameters.some(isVararg));

        if (!mainConstructor) {
            if (hasParent && cls.cType) {
                const getTypeFunc = cTypeToGetTypeFunc(cls.cType);
                const override = hasParent ? "override " : "";
                return `  protected ${override}createPtr(_args: unknown[]): unknown {
    const gtype = call(
      "${sharedLibrary}",
      "${getTypeFunc}",
      [],
      { type: "int", size: 64, unsigned: true }
    ) as number;
    return call(
      "libgobject-2.0.so.0",
      "g_object_new",
      [
        { type: { type: "int", size: 64, unsigned: true }, value: gtype },
        { type: { type: "gobject" }, value: null },
      ],
      { type: "gobject", borrowed: true }
    );
  }
`;
            }
            if (hasParent) {
                return `  protected override createPtr(_args: unknown[]): unknown {\n    return null;\n  }\n`;
            }
            return `  protected createPtr(_args: unknown[]): unknown {\n    return null;\n  }\n`;
        }

        const filteredParams = mainConstructor.parameters.filter(
            (p, i) => !isVararg(p) && !this.typeMapper.isClosureTarget(i, mainConstructor.parameters),
        );
        const paramTypes = filteredParams.map((p) => this.typeMapper.mapParameter(p).ts);
        const paramNames = filteredParams.map((p) => toValidIdentifier(toCamelCase(p.name)));

        const hasParams = paramNames.length > 0;
        const hasArgsParam = paramNames.includes("args");
        const arrayParamName = hasArgsParam ? "ctorArgs" : hasParams ? "args" : "_args";
        const destructuring = hasParams
            ? `    const [${paramNames.join(", ")}] = ${arrayParamName} as [${paramTypes.join(", ")}];\n`
            : "";

        const callArgs = this.generateCallArguments(mainConstructor.parameters);
        const override = hasParent ? "override " : "";
        const borrowed = mainConstructor.returnType.transferOwnership !== "full";

        return `  protected ${override}createPtr(${arrayParamName}: unknown[]): unknown {
${destructuring}    return call(
      "${sharedLibrary}",
      "${mainConstructor.cIdentifier}",
      [
${callArgs}
      ],
      { type: "gobject", borrowed: ${borrowed} }
    );
  }
`;
    }

    private generateStaticFactoryMethod(ctor: GirConstructor, className: string, sharedLibrary: string): string {
        let methodName = "new";
        if (ctor.cIdentifier) {
            const parts = ctor.cIdentifier.split("_");
            const nameParts = parts.slice(2).join("_");
            if (nameParts && nameParts !== "new") {
                methodName = toCamelCase(nameParts);
            }
        }

        const params = this.generateParameterList(ctor.parameters);
        const args = this.generateCallArguments(ctor.parameters);
        const ctorDoc = formatMethodDoc(ctor.doc, ctor.parameters);
        const borrowed = ctor.returnType.transferOwnership !== "full";

        this.usesGetObject = true;
        return `${ctorDoc}  static ${methodName}(${params}): ${className} {
    const ptr = call(
      "${sharedLibrary}",
      "${ctor.cIdentifier}",
      [
${args}
      ],
      { type: "gobject", borrowed: ${borrowed} }
    );
    return getObject(ptr) as ${className};
  }
`;
    }

    private generateStaticFunctions(functions: GirFunction[], sharedLibrary: string, className: string): string {
        const sections: string[] = [];

        for (const func of functions) {
            sections.push(this.generateStaticFunction(func, sharedLibrary, className));
        }

        return sections.join("\n");
    }

    private generateStaticFunction(func: GirFunction, sharedLibrary: string, className: string): string {
        const funcName = toValidIdentifier(toCamelCase(func.name));
        const params = this.generateParameterList(func.parameters);
        const returnTypeMapping = this.typeMapper.mapType(func.returnType, true);

        const returnsOwnClass = func.returnType.name === className || func.returnType.name?.endsWith(`.${className}`);
        const rawReturnType = returnsOwnClass ? className : returnTypeMapping.ts;
        const tsReturnType = rawReturnType === "void" ? "" : `: ${rawReturnType}`;

        const hasResultParam = func.parameters.some((p) => toValidIdentifier(toCamelCase(p.name)) === "result");
        const resultVarName = hasResultParam ? "_result" : "result";

        const needsCast = rawReturnType !== "void" && rawReturnType !== "unknown";
        const hasReturnValue = rawReturnType !== "void";

        const lines: string[] = [];
        const funcDoc = formatMethodDoc(func.doc, func.parameters);
        if (funcDoc) {
            lines.push(funcDoc.trimEnd());
        }
        lines.push(`  static ${funcName}(${params})${tsReturnType} {`);

        if (func.throws) {
            lines.push(`    const error = { value: null as unknown };`);
        }

        const args = this.generateCallArguments(func.parameters);
        const errorArg = func.throws ? this.generateErrorArgument() : "";
        const allArgs = errorArg ? args + (args ? ",\n" : "") + errorArg : args;

        if (returnsOwnClass) {
            this.usesGetObject = true;
            lines.push(`    const ptr = call(
      "${sharedLibrary}",
      "${func.cIdentifier}",
      [
${allArgs ? `${allArgs},` : ""}
      ],
      ${this.generateTypeDescriptor(returnTypeMapping.ffi)}
    );`);
            if (func.throws) {
                lines.push(this.generateErrorCheck());
            }
            lines.push(`    return getObject(ptr) as ${className};`);
        } else {
            const callPrefix = func.throws
                ? hasReturnValue
                    ? `const ${resultVarName} = `
                    : ""
                : hasReturnValue
                  ? "return "
                  : "";

            lines.push(`    ${callPrefix}call(
      "${sharedLibrary}",
      "${func.cIdentifier}",
      [
${allArgs ? `${allArgs},` : ""}
      ],
      ${this.generateTypeDescriptor(returnTypeMapping.ffi)}
    )${needsCast ? ` as ${rawReturnType}` : ""};`);

            if (func.throws) {
                lines.push(this.generateErrorCheck());
                if (hasReturnValue) {
                    lines.push(`    return ${resultVarName};`);
                }
            }
        }

        lines.push(`  }`);
        return `${lines.join("\n")}\n`;
    }

    private generateMethods(methods: GirMethod[], sharedLibrary: string, className?: string, isRecord = false): string {
        const generatedMethods = new Set<string>();
        const sections: string[] = [];

        const asyncMethods = new Set<string>();
        const finishMethods = new Set<string>();
        for (const method of methods) {
            if (this.hasAsyncCallback(method)) {
                asyncMethods.add(method.name);
                finishMethods.add(`${method.name}_finish`);
            }
        }

        for (const method of methods) {
            const methodKey = `${toCamelCase(method.name)}:${method.cIdentifier}`;
            if (generatedMethods.has(methodKey)) continue;
            generatedMethods.add(methodKey);

            if (asyncMethods.has(method.name) || finishMethods.has(method.name)) {
                const asyncWrapper = this.generateAsyncWrapper(method, methods, sharedLibrary, className);
                if (asyncWrapper) {
                    sections.push(asyncWrapper);
                }
                continue;
            }

            sections.push(this.generateMethod(method, sharedLibrary, className, isRecord));
        }

        return sections.join("\n");
    }

    private hasAsyncCallback(method: GirMethod): boolean {
        return method.parameters.some((p) => p.type.name === "Gio.AsyncReadyCallback");
    }

    private findFinishMethod(asyncMethod: GirMethod, allMethods: GirMethod[]): GirMethod | undefined {
        const finishName = `${asyncMethod.name}_finish`;
        return allMethods.find((m) => m.name === finishName);
    }

    private generateAsyncWrapper(
        method: GirMethod,
        allMethods: GirMethod[],
        sharedLibrary: string,
        className?: string,
    ): string | null {
        if (!this.hasAsyncCallback(method)) return null;

        const finishMethod = this.findFinishMethod(method, allMethods);
        if (!finishMethod) return null;

        let methodName = toCamelCase(method.name);
        if (className) {
            const renamed = getRenamedMethod(this.options.namespace, className, methodName);
            if (renamed) methodName = renamed;
        }

        const paramsWithoutCallback = method.parameters.filter(
            (p, i) =>
                !isVararg(p) &&
                p.type.name !== "Gio.AsyncReadyCallback" &&
                !this.typeMapper.isClosureTarget(i, method.parameters),
        );

        let hasRequiredAfterOptional = false;
        let seenOptional = false;
        for (const p of paramsWithoutCallback) {
            const isOptional = this.typeMapper.isNullable(p);
            if (isOptional) seenOptional = true;
            else if (seenOptional) hasRequiredAfterOptional = true;
        }
        if (hasRequiredAfterOptional) {
            return null;
        }

        const params = paramsWithoutCallback
            .map((p) => {
                const mapped = this.typeMapper.mapParameter(p);
                const paramName = toValidIdentifier(toCamelCase(p.name));
                const isOptional = this.typeMapper.isNullable(p);
                return `${paramName}${isOptional ? "?" : ""}: ${mapped.ts}`;
            })
            .join(", ");

        const finishParams = finishMethod.parameters.filter((p) => !isVararg(p));
        const outputParams = finishParams.filter(
            (p) => p.direction === "out" || (p.type.name !== "Gio.AsyncResult" && p.direction !== "in"),
        );

        const returnTypeMapping = this.typeMapper.mapType(finishMethod.returnType, true);
        const mainReturnType = returnTypeMapping.ts;
        const hasMainReturn = mainReturnType !== "void";
        const isNullable = finishMethod.returnType.nullable === true;

        this.addGioImport = true;

        const promiseType = this.buildAsyncReturnType(hasMainReturn, mainReturnType, outputParams, isNullable);

        const lines: string[] = [];
        lines.push(`  /**`);
        lines.push(`   * Promise-based version of ${methodName}.`);
        if (method.doc) {
            const docLines = sanitizeDoc(method.doc).split("\n").slice(0, 3);
            for (const line of docLines) {
                lines.push(`   * ${line.trim()}`);
            }
        }
        lines.push(`   */`);
        lines.push(`  ${methodName}(${params}): Promise<${promiseType}> {`);
        lines.push(`    return new Promise((resolve, reject) => {`);

        const callArgs = this.buildAsyncCallArgs(method, finishMethod, outputParams, sharedLibrary, isNullable);
        lines.push(callArgs);

        lines.push(`    });`);
        lines.push(`  }`);

        return `${lines.join("\n")}\n`;
    }

    private buildAsyncReturnType(
        hasMainReturn: boolean,
        mainReturnType: string,
        outputParams: GirParameter[],
        isNullable = false,
    ): string {
        if (outputParams.length === 0) {
            if (!hasMainReturn) return "void";
            return isNullable ? `${mainReturnType} | null` : mainReturnType;
        }

        const outputTypes: string[] = [];
        if (hasMainReturn) {
            const returnType = isNullable ? `${mainReturnType} | null` : mainReturnType;
            outputTypes.push(`result: ${returnType}`);
        }
        for (const param of outputParams) {
            const paramName = toValidIdentifier(toCamelCase(param.name));
            const mapped = this.typeMapper.mapParameter(param);
            let paramType = mapped.ts;
            if (paramType.startsWith("Ref<") && paramType.endsWith(">")) {
                paramType = paramType.slice(4, -1);
            }
            outputTypes.push(`${paramName}: ${paramType}`);
        }

        return `{ ${outputTypes.join("; ")} }`;
    }

    private buildAsyncCallArgs(
        method: GirMethod,
        finishMethod: GirMethod,
        outputParams: GirParameter[],
        sharedLibrary: string,
        isNullable = false,
    ): string {
        const returnTypeMapping = this.typeMapper.mapType(finishMethod.returnType, true);
        const hasMainReturn = returnTypeMapping.ts !== "void";
        const needsObjectWrap =
            (returnTypeMapping.ffi.type === "gobject" || returnTypeMapping.ffi.type === "boxed") &&
            returnTypeMapping.ts !== "unknown";

        const lines: string[] = [];

        for (const param of outputParams) {
            const paramName = toValidIdentifier(toCamelCase(param.name));
            lines.push(`      const ${paramName}Ref = { value: null as unknown };`);
        }

        const nonCallbackParams = method.parameters.filter(
            (p, i) =>
                !isVararg(p) &&
                p.type.name !== "Gio.AsyncReadyCallback" &&
                !this.typeMapper.isClosureTarget(i, method.parameters),
        );

        const asyncCallArgs = nonCallbackParams
            .map((param) => {
                const mapped = this.typeMapper.mapParameter(param);
                const jsParamName = toValidIdentifier(toCamelCase(param.name));
                const needsPtr = mapped.ffi.type === "gobject" || mapped.ffi.type === "boxed";
                const valueName = needsPtr ? `(${jsParamName} as any)?.id ?? ${jsParamName}` : jsParamName;
                return `          {\n            type: ${this.generateTypeDescriptor(mapped.ffi)},\n            value: ${valueName},\n          }`;
            })
            .join(",\n");

        const finishCallArgs = this.generateFinishCallArguments(finishMethod.parameters, outputParams);
        const finishReturnType = this.typeMapper.mapType(finishMethod.returnType, true);

        lines.push(`      const callback = (_source: unknown, asyncResult: unknown) => {`);
        lines.push(`        try {`);

        if (finishMethod.throws) {
            lines.push(`          const error = { value: null as unknown };`);
        }

        const errorArg = finishMethod.throws
            ? `,\n            { type: { type: "ref", innerType: { type: "boxed", innerType: "GError", lib: "libglib-2.0.so.0" } }, value: error }`
            : "";

        if (hasMainReturn) {
            const varName = needsObjectWrap ? "ptr" : "result";
            const castType = needsObjectWrap ? "unknown" : finishReturnType.ts;
            lines.push(`          const ${varName} = call(`);
            lines.push(`            "${sharedLibrary}",`);
            lines.push(`            "${finishMethod.cIdentifier}",`);
            lines.push(`            [`);
            lines.push(`              { type: { type: "gobject" }, value: this.id },`);
            lines.push(`${finishCallArgs}${errorArg}`);
            lines.push(`            ],`);
            lines.push(`            ${this.generateTypeDescriptor(finishReturnType.ffi)}`);
            lines.push(`          ) as ${castType};`);
        } else {
            lines.push(`          call(`);
            lines.push(`            "${sharedLibrary}",`);
            lines.push(`            "${finishMethod.cIdentifier}",`);
            lines.push(`            [`);
            lines.push(`              { type: { type: "gobject" }, value: this.id },`);
            lines.push(`${finishCallArgs}${errorArg}`);
            lines.push(`            ],`);
            lines.push(`            { type: "undefined" }`);
            lines.push(`          );`);
        }

        if (finishMethod.throws) {
            lines.push(`          if (error.value !== null) {`);
            lines.push(`            throw new NativeError(error.value);`);
            lines.push(`          }`);
            this.usesNativeError = true;
        }

        if (outputParams.length === 0) {
            if (hasMainReturn) {
                if (needsObjectWrap) {
                    this.usesGetObject = true;
                    if (isNullable) {
                        lines.push(`          if (ptr === null) { resolve(null); return; }`);
                    }
                    lines.push(`          resolve(getObject(ptr) as ${finishReturnType.ts});`);
                } else {
                    lines.push(`          resolve(result);`);
                }
            } else {
                lines.push(`          resolve();`);
            }
        } else {
            const resolveFields: string[] = [];
            if (hasMainReturn) {
                if (needsObjectWrap) {
                    this.usesGetObject = true;
                    if (isNullable) {
                        lines.push(
                            `          const result = (ptr === null ? null : getObject(ptr)) as ${finishReturnType.ts} | null;`,
                        );
                    } else {
                        lines.push(`          const result = getObject(ptr) as ${finishReturnType.ts};`);
                    }
                }
                resolveFields.push("result");
            }
            for (const param of outputParams) {
                const paramName = toValidIdentifier(toCamelCase(param.name));
                const mapped = this.typeMapper.mapParameter(param);
                let paramType = mapped.ts;
                if (paramType.startsWith("Ref<") && paramType.endsWith(">")) {
                    paramType = paramType.slice(4, -1);
                }
                resolveFields.push(`${paramName}: ${paramName}Ref.value as ${paramType}`);
            }
            lines.push(`          resolve({ ${resolveFields.join(", ")} });`);
        }

        lines.push(`        } catch (err) {`);
        lines.push(`          reject(err);`);
        lines.push(`        }`);
        lines.push(`      };`);

        lines.push(`      call(`);
        lines.push(`        "${sharedLibrary}",`);
        lines.push(`        "${method.cIdentifier}",`);
        lines.push(`        [`);
        lines.push(`          { type: { type: "gobject" }, value: this.id },`);
        if (asyncCallArgs) {
            lines.push(`${asyncCallArgs},`);
        }
        lines.push(`          {`);
        lines.push(
            `            type: { type: "callback", trampoline: "asyncReady", sourceType: { type: "gobject", borrowed: true }, resultType: { type: "gobject", borrowed: true } },`,
        );
        lines.push(`            value: callback,`);
        lines.push(`          },`);
        lines.push(`        ],`);
        lines.push(`        { type: "undefined" }`);
        lines.push(`      );`);

        return lines.join("\n");
    }

    private generateFinishCallArguments(parameters: GirParameter[], outputParams: GirParameter[]): string {
        return parameters
            .filter((p) => !isVararg(p))
            .map((param) => {
                const paramName = toValidIdentifier(toCamelCase(param.name));
                if (param.type.name === "Gio.AsyncResult") {
                    return `              { type: { type: "gobject" }, value: asyncResult }`;
                }
                if (outputParams.some((op) => op.name === param.name)) {
                    const mapped = this.typeMapper.mapParameter(param);
                    return `              { type: ${this.generateTypeDescriptor(mapped.ffi)}, value: ${paramName}Ref }`;
                }
                const mapped = this.typeMapper.mapParameter(param);
                const needsPtr = mapped.ffi.type === "gobject" || mapped.ffi.type === "boxed";
                const valueName = needsPtr ? `(${paramName} as any)?.id ?? ${paramName}` : paramName;
                return `              { type: ${this.generateTypeDescriptor(mapped.ffi)}, value: ${valueName} }`;
            })
            .join(",\n");
    }

    private generateMethod(method: GirMethod, sharedLibrary: string, className?: string, isRecord = false): string {
        let methodName = toCamelCase(method.name);
        if (className) {
            const renamed = getRenamedMethod(this.options.namespace, className, methodName);
            if (renamed) {
                methodName = renamed;
            }
        }

        const params = this.generateParameterList(method.parameters);
        const returnTypeMapping = this.typeMapper.mapType(method.returnType, true);
        const isNullable = method.returnType.nullable === true;
        const baseReturnType = returnTypeMapping.ts === "void" ? "void" : returnTypeMapping.ts;
        const tsReturnType = isNullable && baseReturnType !== "void" ? `${baseReturnType} | null` : baseReturnType;
        const returnTypeAnnotation = tsReturnType !== "void" ? `: ${tsReturnType}` : "";

        const hasResultParam = method.parameters.some((p) => toValidIdentifier(toCamelCase(p.name)) === "result");
        const resultVarName = hasResultParam ? "_result" : "result";

        const needsObjectWrap =
            (returnTypeMapping.ffi.type === "gobject" || returnTypeMapping.ffi.type === "boxed") &&
            baseReturnType !== "unknown" &&
            returnTypeMapping.kind !== "interface";
        const needsArrayWrap =
            returnTypeMapping.ffi.type === "array" &&
            returnTypeMapping.ffi.itemType?.type === "gobject" &&
            baseReturnType.endsWith("[]");
        const hasReturnValue = returnTypeMapping.ts !== "void";

        // For records (boxed types), use "boxed" type with innerType; for classes, use "gobject"
        const selfTypeDescriptor =
            isRecord && className
                ? `{ type: "boxed", borrowed: true, innerType: "${className}", lib: "${sharedLibrary}" }`
                : `{ type: "gobject" }`;

        const lines: string[] = [];
        const methodDoc = formatMethodDoc(method.doc, method.parameters);
        if (methodDoc) {
            lines.push(methodDoc.trimEnd());
        }
        lines.push(`  ${methodName}(${params})${returnTypeAnnotation} {`);

        if (method.throws) {
            lines.push(`    const error = { value: null as unknown };`);
        }

        const args = this.generateCallArguments(method.parameters);
        const errorArg = method.throws ? this.generateErrorArgument() : "";
        const allArgs = errorArg ? args + (args ? ",\n" : "") + errorArg : args;

        if (needsObjectWrap && hasReturnValue) {
            const isCyclic = this.cyclicReturnTypes.has(tsReturnType);
            lines.push(`    const ptr = call(
      "${sharedLibrary}",
      "${method.cIdentifier}",
      [
        {
          type: ${selfTypeDescriptor},
          value: this.id,
        },
${allArgs ? `${allArgs},` : ""}
      ],
      ${this.generateTypeDescriptor(returnTypeMapping.ffi)}
    );`);
            if (method.throws) {
                lines.push(this.generateErrorCheck());
            }
            if (isNullable) {
                lines.push(`    if (ptr === null) return null;`);
            }
            if (isCyclic) {
                // For cyclic types, return a minimal NativeObject wrapper. Cast is necessary
                // because the full type interface isn't available without circular imports.
                lines.push(`    return { id: ptr } as unknown as ${baseReturnType};`);
            } else {
                this.usesGetObject = true;
                lines.push(`    return getObject(ptr) as ${baseReturnType};`);
            }
        } else if (needsArrayWrap && hasReturnValue) {
            const elementType = baseReturnType.slice(0, -2);
            this.usesGetObject = true;
            lines.push(`    const ptrs = call(
      "${sharedLibrary}",
      "${method.cIdentifier}",
      [
        {
          type: ${selfTypeDescriptor},
          value: this.id,
        },
${allArgs ? `${allArgs},` : ""}
      ],
      ${this.generateTypeDescriptor(returnTypeMapping.ffi)}
    ) as unknown[];`);
            if (method.throws) {
                lines.push(this.generateErrorCheck());
            }
            lines.push(`    return ptrs.map(ptr => getObject(ptr) as ${elementType});`);
        } else {
            const callPrefix = method.throws
                ? hasReturnValue
                    ? `const ${resultVarName} = `
                    : ""
                : hasReturnValue
                  ? "return "
                  : "";

            const needsCast = returnTypeMapping.ts !== "void" && returnTypeMapping.ts !== "unknown";

            lines.push(`    ${callPrefix}call(
      "${sharedLibrary}",
      "${method.cIdentifier}",
      [
        {
          type: ${selfTypeDescriptor},
          value: this.id,
        },
${allArgs ? `${allArgs},` : ""}
      ],
      ${this.generateTypeDescriptor(returnTypeMapping.ffi)}
    )${needsCast ? ` as ${tsReturnType}` : ""};`);

            if (method.throws) {
                lines.push(this.generateErrorCheck());
                if (hasReturnValue) {
                    lines.push(`    return ${resultVarName};`);
                }
            }
        }

        lines.push(`  }`);
        return `${lines.join("\n")}\n`;
    }

    private extractSignalParamClass(param: GirParameter, classMap: Map<string, GirClass>): string | undefined {
        const typeName = param.type.name;
        if (!typeName) return undefined;

        if (typeName.includes(".")) {
            const [ns, className] = typeName.split(".", 2);
            if (!className) return undefined;

            if (this.options.typeRegistry) {
                const registered = this.options.typeRegistry.resolve(typeName);
                if (!registered || (registered.kind !== "class" && registered.kind !== "interface")) {
                    return undefined;
                }
            }

            const normalizedName = normalizeClassName(className);
            if (ns === this.options.namespace) {
                return normalizedName;
            }
            return `${ns}.${normalizedName}`;
        }

        const normalizedName = normalizeClassName(typeName);
        if (classMap.has(typeName) || classMap.has(normalizedName)) {
            return normalizedName;
        }

        return undefined;
    }

    private generateSignalConnect(
        sharedLibrary: string,
        signals: GirSignal[],
        hasConnectMethod: boolean,
        classMap: Map<string, GirClass>,
        className: string,
    ): { moduleLevel: string; method: string } {
        const methodName = hasConnectMethod ? "on" : "connect";

        const savedEnumCallback = this.typeMapper.getEnumUsageCallback();
        const savedRecordCallback = this.typeMapper.getRecordUsageCallback();
        this.typeMapper.setEnumUsageCallback(null);
        this.typeMapper.setRecordUsageCallback(null);
        this.typeMapper.setExternalTypeUsageCallback(null);
        this.typeMapper.setSameNamespaceClassUsageCallback(null);

        const signalMetadata = signals.map((signal) => {
            const paramEntries = (signal.parameters ?? []).map((param) => {
                const ffiType = JSON.stringify(this.typeMapper.mapParameter(param).ffi);
                const signalParamClass = this.extractSignalParamClass(param, classMap);
                if (signalParamClass) {
                    const dotIndex = signalParamClass.indexOf(".");
                    if (dotIndex !== -1) {
                        const ns = signalParamClass.slice(0, dotIndex);
                        const clsName = signalParamClass.slice(dotIndex + 1);
                        this.usedExternalTypes.set(signalParamClass, {
                            namespace: ns,
                            name: clsName,
                            transformedName: clsName,
                            kind: "class",
                        });
                    } else {
                        this.signalClasses.add(signalParamClass);
                    }
                    return `{ type: ${ffiType}, getCls: () => ${signalParamClass} }`;
                }
                return `{ type: ${ffiType} }`;
            });
            const returnTypeFfi = signal.returnType
                ? JSON.stringify(this.typeMapper.mapType(signal.returnType).ffi)
                : null;
            const returnTypePart = returnTypeFfi ? `, returnType: ${returnTypeFfi}` : "";
            return `    "${signal.name}": { params: [${paramEntries.join(", ")}]${returnTypePart} }`;
        });

        this.typeMapper.setEnumUsageCallback(savedEnumCallback);
        this.typeMapper.setRecordUsageCallback(savedRecordCallback);
        this.typeMapper.setExternalTypeUsageCallback((usage) => {
            const key = `${usage.namespace}.${usage.transformedName}`;
            this.usedExternalTypes.set(key, usage);
        });
        this.typeMapper.setSameNamespaceClassUsageCallback((clsName, originalName) => {
            this.usedSameNamespaceClasses.set(clsName, originalName);
        });

        const signalOverloads = signals.map((signal) => {
            const signalParams = signal.parameters ?? [];
            const handlerParams = [`self: ${className}`];
            for (const param of signalParams) {
                const paramName = toValidIdentifier(toCamelCase(param.name));
                const signalParamClass = this.extractSignalParamClass(param, classMap);
                const paramType = signalParamClass ?? this.typeMapper.mapType(param.type).ts;
                handlerParams.push(`${paramName}: ${paramType}`);
            }
            const returnType = signal.returnType ? this.typeMapper.mapType(signal.returnType).ts : "void";
            return `  ${methodName}(signal: "${signal.name}", handler: (${handlerParams.join(", ")}) => ${returnType}, after?: boolean): number;`;
        });

        const hasNotifySignal = signals.some((s) => s.name === "notify");
        if (!hasNotifySignal && this.options.namespace !== "GObject") {
            signalOverloads.push(
                `  ${methodName}(signal: "notify", handler: (self: ${className}, pspec: GObject.ParamSpec) => void, after?: boolean): number;`,
            );
            this.usedExternalTypes.set("GObject.ParamSpec", {
                namespace: "GObject",
                name: "ParamSpec",
                transformedName: "ParamSpec",
                kind: "class",
            });
        }

        // Signal handler catch-all overload must use `any` for compatibility with typed overloads.
        // The typed overloads have specific return types, and unknown is not assignable to them.
        signalOverloads.push(
            `  ${methodName}(signal: string, handler: (...args: any[]) => any, after?: boolean): number;`,
        );

        this.usesType = true;
        this.usesGetObject = true;
        if (signalMetadata.length > 0) {
            this.usesSignalMeta = true;
        }

        const moduleLevel =
            signalMetadata.length > 0 ? `const SIGNAL_META: SignalMeta = {\n${signalMetadata.join(",\n")}\n};\n` : "";

        const signalMapCode =
            signalMetadata.length > 0
                ? `const meta = SIGNAL_META[signal];
    const selfType: Type = { type: "gobject", borrowed: true };
    const argTypes = meta ? [selfType, ...meta.params.map((m) => m.type)] : [selfType];
    const returnType = meta?.returnType;`
                : `const selfType: Type = { type: "gobject", borrowed: true };\n    const argTypes = [selfType];\n    const returnType = undefined;`;

        const wrapperCode =
            signalMetadata.length > 0
                ? `const wrappedHandler = (...args: unknown[]) => {
      const self = getObject(args[0]);
      const signalArgs = args.slice(1);
      if (!meta) return handler(self, ...signalArgs);
      const wrapped = meta.params.map((m, i) => {
        if (m.getCls && signalArgs[i] != null) {
          return getObject(signalArgs[i]);
        }
        return signalArgs[i];
      });
      return handler(self, ...wrapped);
    };`
                : `const wrappedHandler = (...args: unknown[]) => {
      const self = getObject(args[0]);
      return handler(self, ...args.slice(1));
    };`;

        const overloadsSection = signalOverloads.length > 0 ? `${signalOverloads.join("\n")}\n` : "";

        const method = `${overloadsSection}  ${methodName}(
    signal: string,
    handler: (...args: any[]) => any,
    after = false
  ): number {
    ${signalMapCode}
    ${wrapperCode}
    return call(
      "${sharedLibrary}",
      "g_signal_connect_closure",
      [
        { type: { type: "gobject" }, value: this.id },
        { type: { type: "string" }, value: signal },
        { type: { type: "callback", argTypes, returnType }, value: wrappedHandler },
        { type: { type: "boolean" }, value: after },
      ],
      { type: "int", size: 64, unsigned: true }
    ) as number;
  }
`;

        return { moduleLevel, method };
    }

    private async generateInterface(
        iface: GirInterface,
        sharedLibrary: string,
        _classMap: Map<string, GirClass>,
    ): Promise<string> {
        this.resetState();

        const interfaceName = toPascalCase(iface.name);
        const sections: string[] = [];

        this.usesCall = iface.methods.length > 0;
        this.usesRef = iface.methods.some((m) => hasOutParameter(m.parameters));

        if (iface.doc) {
            sections.push(formatDoc(iface.doc));
        }
        sections.push(`export class ${interfaceName} {`);
        if (iface.glibTypeName) {
            sections.push(`  static readonly glibTypeName: string = "${iface.glibTypeName}";\n`);
        }
        sections.push(`  id: unknown;`);
        sections.push(``);
        sections.push(`  protected constructor(id: unknown) {`);
        sections.push(`    this.id = id;`);
        sections.push(`  }`);
        sections.push(``);
        sections.push(`  static fromPtr(id: unknown): ${interfaceName} {`);
        sections.push(`    return new ${interfaceName}(id);`);
        sections.push(`  }`);

        if (iface.methods.length > 0) {
            sections.push(this.generateMethods(iface.methods, sharedLibrary, interfaceName));
        }

        sections.push("}");

        const imports = this.generateImports(interfaceName);
        return this.formatCode(imports + sections.join("\n"));
    }

    private async generateRecord(record: GirRecord, sharedLibrary: string): Promise<string> {
        this.resetState();

        this.usesRef =
            record.methods.some((m) => hasOutParameter(m.parameters)) ||
            record.constructors.some((c) => hasOutParameter(c.parameters)) ||
            record.functions.some((f) => hasOutParameter(f.parameters));
        this.usesCall = record.methods.length > 0 || record.constructors.length > 0 || record.functions.length > 0;

        const hasReadableFields = record.fields.some((f) => f.readable !== false && !f.private);
        if (hasReadableFields) {
            this.usesRead = true;
        }

        const recordName = normalizeClassName(record.name);
        const sections: string[] = [];

        const initInterface = this.generateRecordInitInterface(record);
        if (initInterface) {
            sections.push(initInterface);
        }

        if (record.doc) {
            sections.push(formatDoc(record.doc));
        }
        sections.push(`export class ${recordName} {`);
        if (record.glibTypeName) {
            sections.push(`  static readonly glibTypeName: string = "${record.glibTypeName}";\n`);
        }
        sections.push(`  id: unknown;\n`);

        sections.push(this.generateRecordConstructors(record, sharedLibrary));
        sections.push(this.generateRecordStaticFunctions(record.functions, sharedLibrary, recordName));
        sections.push(this.generateRecordMethods(record.methods, sharedLibrary, record.name, record.glibTypeName));
        sections.push(this.generateRecordFields(record.fields, record.methods));

        sections.push("}");

        if (record.glibTypeName) {
            this.usesRegisterType = true;
            sections.push(`\nregisterType(${recordName});`);
        }

        const imports = this.generateImports(recordName);
        return this.formatCode(imports + sections.join("\n"));
    }

    private generateRecordInitInterface(record: GirRecord): string | null {
        const mainConstructor = record.constructors.find((c) => !c.parameters.some(isVararg));
        if (mainConstructor) return null;

        const initFields = this.getWritableFields(record.fields);
        if (initFields.length === 0) return null;

        const recordName = normalizeClassName(record.name);
        return this.generateFieldInitInterface(recordName, initFields);
    }

    private generateRecordConstructors(record: GirRecord, sharedLibrary: string): string {
        const recordName = normalizeClassName(record.name);
        const sections: string[] = [];

        const mainConstructor = record.constructors.find((c) => !c.parameters.some(isVararg));
        if (mainConstructor) {
            const ctorDoc = formatMethodDoc(mainConstructor.doc, mainConstructor.parameters);
            const filteredParams = mainConstructor.parameters.filter((p) => !isVararg(p));

            if (filteredParams.length === 0) {
                sections.push(`${ctorDoc}  constructor() {\n    this.id = this.createPtr([]);\n  }\n`);
            } else {
                const typedParams = this.generateParameterList(mainConstructor.parameters, false);
                const paramNames = filteredParams.map((p) => toValidIdentifier(toCamelCase(p.name)));
                const firstParamType = this.typeMapper.mapParameter(filteredParams[0] as GirParameter).ts;
                const isFirstParamArray = firstParamType.endsWith("[]") || firstParamType.startsWith("Array<");

                if (isFirstParamArray) {
                    sections.push(`${ctorDoc}  constructor(${typedParams}) {
    const _args = [${paramNames.join(", ")}];
    this.id = this.createPtr(_args);
  }
`);
                } else {
                    sections.push(`${ctorDoc}  constructor(${typedParams});
  constructor(_args: unknown[]);
  constructor(...args: unknown[]) {
    const _args = args.length === 1 && Array.isArray(args[0]) ? args[0] : args;
    this.id = this.createPtr(_args);
  }
`);
                }
            }

            for (const ctor of record.constructors) {
                if (ctor !== mainConstructor) {
                    sections.push(this.generateRecordStaticFactoryMethod(ctor, recordName, sharedLibrary));
                }
            }
        } else {
            const initFields = this.getWritableFields(record.fields);
            if (initFields.length > 0) {
                sections.push(
                    `  constructor(init: ${recordName}Init = {}) {\n    this.id = this.createPtr(init);\n  }\n`,
                );
            } else {
                sections.push(`  constructor() {\n    this.id = this.createPtr({});\n  }\n`);
            }
        }

        sections.push(this.generateRecordCreatePtr(record, sharedLibrary));
        return sections.join("\n");
    }

    private getWritableFields(fields: GirField[]): GirField[] {
        return fields.filter((f) => !f.private && f.writable !== false && this.isWritableType(f.type));
    }

    private generateFieldInitInterface(recordName: string, fields: GirField[]): string {
        const properties = fields.map((field) => {
            const fieldName = toValidIdentifier(toCamelCase(field.name));
            const typeMapping = this.typeMapper.mapType(field.type);
            return `  ${fieldName}?: ${typeMapping.ts};`;
        });
        return `export interface ${recordName}Init {\n${properties.join("\n")}\n}\n\n`;
    }

    private generateRecordCreatePtr(record: GirRecord, sharedLibrary: string): string {
        const recordName = normalizeClassName(record.name);
        const mainConstructor = record.constructors.find((c) => !c.parameters.some(isVararg));

        if (!mainConstructor) {
            if (record.glibTypeName && record.fields.length > 0) {
                const structSize = this.calculateStructSize(record.fields);
                const initFields = this.getWritableFields(record.fields);
                this.usesAlloc = true;

                if (initFields.length > 0) {
                    const fieldWrites = this.generateFieldWrites(record.fields);
                    this.usesWrite = true;
                    return `  protected createPtr(init: ${recordName}Init): unknown {
    const ptr = alloc(${structSize}, "${record.glibTypeName}", "${sharedLibrary}");
${fieldWrites}
    return ptr;
  }
`;
                }

                return `  protected createPtr(_init: Record<string, unknown>): unknown {
    return alloc(${structSize}, "${record.glibTypeName}", "${sharedLibrary}");
  }
`;
            }
            return `  protected createPtr(_init: Record<string, unknown>): unknown {\n    return null;\n  }\n`;
        }

        const filteredParams = mainConstructor.parameters.filter(
            (p, i) => !isVararg(p) && !this.typeMapper.isClosureTarget(i, mainConstructor.parameters),
        );
        const paramTypes = filteredParams.map((p) => this.typeMapper.mapParameter(p).ts);
        const paramNames = filteredParams.map((p) => toValidIdentifier(toCamelCase(p.name)));

        const destructuring =
            paramNames.length > 0
                ? `    const [${paramNames.join(", ")}] = _args as [${paramTypes.join(", ")}];\n`
                : "";

        const args = this.generateCallArguments(mainConstructor.parameters);
        const glibTypeName = record.glibTypeName ?? record.cType;

        return `  protected createPtr(_args: unknown[]): unknown {
${destructuring}    return call(
      "${sharedLibrary}",
      "${mainConstructor.cIdentifier}",
      [
${args}
      ],
      { type: "boxed", borrowed: true, innerType: "${glibTypeName}" }
    );
  }
`;
    }

    private generateFieldWrites(fields: GirField[]): string {
        const writes: string[] = [];
        let currentOffset = 0;

        for (const field of fields) {
            if (field.private) continue;
            const fieldSize = this.getFieldSize(field.type);
            const alignment = this.getFieldAlignment(field.type);
            currentOffset = Math.ceil(currentOffset / alignment) * alignment;

            if (field.writable !== false && this.isWritableType(field.type)) {
                const fieldName = toValidIdentifier(toCamelCase(field.name));
                const typeMapping = this.typeMapper.mapType(field.type);
                writes.push(
                    `    if (init.${fieldName} !== undefined) write(ptr, ${this.generateTypeDescriptor(typeMapping.ffi)}, ${currentOffset}, init.${fieldName});`,
                );
            }

            currentOffset += fieldSize;
        }

        return writes.join("\n");
    }

    private calculateStructSize(fields: GirField[]): number {
        let currentOffset = 0;
        for (const field of fields) {
            const fieldSize = this.getFieldSize(field.type);
            const alignment = this.getFieldAlignment(field.type);
            currentOffset = Math.ceil(currentOffset / alignment) * alignment;
            currentOffset += fieldSize;
        }
        const maxAlignment = Math.max(...fields.map((f) => this.getFieldAlignment(f.type)), 1);
        return Math.ceil(currentOffset / maxAlignment) * maxAlignment;
    }

    private generateRecordStaticFactoryMethod(ctor: GirConstructor, recordName: string, sharedLibrary: string): string {
        let methodName = "new";
        if (ctor.cIdentifier) {
            const parts = ctor.cIdentifier.split("_");
            const nameParts = parts.slice(2).join("_");
            if (nameParts && nameParts !== "new") {
                methodName = toCamelCase(nameParts);
            }
        }

        const params = this.generateParameterList(ctor.parameters);
        const args = this.generateCallArguments(ctor.parameters);
        const ctorDoc = formatMethodDoc(ctor.doc, ctor.parameters);

        this.usesGetObject = true;
        return `${ctorDoc}  static ${methodName}(${params}): ${recordName} {
    const ptr = call(
      "${sharedLibrary}",
      "${ctor.cIdentifier}",
      [
${args}
      ],
      { type: "boxed", borrowed: true, innerType: "${recordName}" }
    );
    return getObject(ptr) as ${recordName};
  }
`;
    }

    private generateRecordStaticFunctions(functions: GirFunction[], sharedLibrary: string, recordName: string): string {
        return this.generateStaticFunctions(functions, sharedLibrary, recordName);
    }

    private generateRecordMethods(
        methods: GirMethod[],
        sharedLibrary: string,
        recordName?: string,
        glibTypeName?: string,
    ): string {
        return this.generateMethods(methods, sharedLibrary, glibTypeName ?? recordName, true);
    }

    private generateRecordFields(fields: GirField[], methods: GirMethod[]): string {
        const sections: string[] = [];
        const fieldOffsets: { field: GirField; offset: number }[] = [];
        const methodNames = new Set(methods.map((m) => toCamelCase(m.name)));

        let currentOffset = 0;
        for (const field of fields) {
            if (field.private) continue;
            const fieldSize = this.getFieldSize(field.type);
            const alignment = this.getFieldAlignment(field.type);
            currentOffset = Math.ceil(currentOffset / alignment) * alignment;
            fieldOffsets.push({ field, offset: currentOffset });
            currentOffset += fieldSize;
        }

        for (const { field, offset } of fieldOffsets) {
            const isReadable = field.readable !== false;
            const isWritable = field.writable !== false;

            if (!isReadable && !isWritable) continue;

            const fieldName = toValidIdentifier(toCamelCase(field.name));
            if (methodNames.has(fieldName)) continue;

            const typeMapping = this.typeMapper.mapType(field.type);

            if (field.doc) {
                sections.push(formatDoc(field.doc, "  ").trimEnd());
            }

            if (isReadable) {
                sections.push(`  get ${fieldName}(): ${typeMapping.ts} {
    return read(this.id, ${this.generateTypeDescriptor(typeMapping.ffi)}, ${offset}) as ${typeMapping.ts};
  }
`);
            }

            if (isWritable && this.isWritableType(field.type)) {
                this.usesWrite = true;
                sections.push(`  set ${fieldName}(value: ${typeMapping.ts}) {
    write(this.id, ${this.generateTypeDescriptor(typeMapping.ffi)}, ${offset}, value);
  }
`);
            }
        }

        return sections.join("\n");
    }

    private isWritableType(type: { name: string; cType?: string }): boolean {
        const typeName = type.name;
        if (
            typeName === "gboolean" ||
            typeName === "guint8" ||
            typeName === "gint8" ||
            typeName === "guchar" ||
            typeName === "gchar"
        ) {
            return true;
        }
        if (typeName === "gint16" || typeName === "guint16" || typeName === "gshort" || typeName === "gushort") {
            return true;
        }
        if (typeName === "gint" || typeName === "guint" || typeName === "gint32" || typeName === "guint32") {
            return true;
        }
        if (
            typeName === "gint64" ||
            typeName === "guint64" ||
            typeName === "glong" ||
            typeName === "gulong" ||
            typeName === "gsize" ||
            typeName === "gssize"
        ) {
            return true;
        }
        if (typeName === "gfloat" || typeName === "float" || typeName === "gdouble" || typeName === "double") {
            return true;
        }
        return false;
    }

    private getFieldSize(type: { name: string; cType?: string }): number {
        const typeName = type.name;
        if (
            typeName === "gboolean" ||
            typeName === "guint8" ||
            typeName === "gint8" ||
            typeName === "guchar" ||
            typeName === "gchar"
        ) {
            return 1;
        }
        if (typeName === "gint16" || typeName === "guint16" || typeName === "gshort" || typeName === "gushort") {
            return 2;
        }
        if (
            typeName === "gint" ||
            typeName === "guint" ||
            typeName === "gint32" ||
            typeName === "guint32" ||
            typeName === "gfloat" ||
            typeName === "float" ||
            typeName === "Quark" ||
            typeName === "GQuark"
        ) {
            return 4;
        }
        if (
            typeName === "gint64" ||
            typeName === "guint64" ||
            typeName === "gdouble" ||
            typeName === "double" ||
            typeName === "glong" ||
            typeName === "gulong" ||
            typeName === "gsize" ||
            typeName === "gssize" ||
            typeName === "GType"
        ) {
            return 8;
        }
        return 8;
    }

    private getFieldAlignment(type: { name: string; cType?: string }): number {
        return this.getFieldSize(type);
    }

    private async generateFunctions(functions: GirFunction[], sharedLibrary: string): Promise<string> {
        this.resetState();

        this.usesRef = functions.some((f) => hasOutParameter(f.parameters));
        this.usesCall = functions.length > 0;

        const sections: string[] = [];

        for (const func of functions) {
            sections.push(this.generateFunction(func, sharedLibrary));
        }

        const imports = this.generateImports();
        return this.formatCode(imports + sections.join("\n"));
    }

    private generateFunction(func: GirFunction, sharedLibrary: string): string {
        const funcName = toValidIdentifier(toCamelCase(func.name));
        const params = this.generateParameterList(func.parameters);
        const returnTypeMapping = this.typeMapper.mapType(func.returnType, true);
        const isNullable = func.returnType.nullable === true;
        const baseReturnType = returnTypeMapping.ts;
        const fullReturnType = isNullable && baseReturnType !== "void" ? `${baseReturnType} | null` : baseReturnType;
        const tsReturnType = fullReturnType === "void" ? "" : `: ${fullReturnType}`;

        const hasResultParam = func.parameters.some((p) => toValidIdentifier(toCamelCase(p.name)) === "result");
        const resultVarName = hasResultParam ? "_result" : "result";

        const needsObjectWrap =
            (returnTypeMapping.ffi.type === "gobject" || returnTypeMapping.ffi.type === "boxed") &&
            returnTypeMapping.ts !== "unknown" &&
            returnTypeMapping.kind !== "interface";
        const hasReturnValue = returnTypeMapping.ts !== "void";

        const lines: string[] = [];
        const funcDoc = formatMethodDoc(func.doc, func.parameters, "");
        if (funcDoc) {
            lines.push(funcDoc.trimEnd());
        }
        lines.push(`export const ${funcName} = (${params})${tsReturnType} => {`);

        if (func.throws) {
            lines.push(`  const error = { value: null as unknown };`);
        }

        const args = this.generateCallArguments(func.parameters, "  ");
        const errorArg = func.throws ? this.generateErrorArgument("  ") : "";
        const allArgs = errorArg ? args + (args ? ",\n" : "") + errorArg : args;

        if (needsObjectWrap && hasReturnValue) {
            this.usesGetObject = true;
            lines.push(`  const ptr = call("${sharedLibrary}", "${func.cIdentifier}", [
${allArgs ? `${allArgs},` : ""}
  ], ${this.generateTypeDescriptor(returnTypeMapping.ffi)});`);
            if (func.throws) {
                lines.push(this.generateErrorCheck(""));
            }
            if (isNullable) {
                lines.push(`  if (ptr === null) return null;`);
            }
            lines.push(`  return getObject(ptr) as ${baseReturnType};`);
        } else {
            const callPrefix = func.throws
                ? hasReturnValue
                    ? `const ${resultVarName} = `
                    : ""
                : hasReturnValue
                  ? "return "
                  : "";

            const needsCast = returnTypeMapping.ts !== "void" && returnTypeMapping.ts !== "unknown";

            lines.push(`  ${callPrefix}call("${sharedLibrary}", "${func.cIdentifier}", [
${allArgs ? `${allArgs},` : ""}
  ], ${this.generateTypeDescriptor(returnTypeMapping.ffi)})${needsCast ? ` as ${returnTypeMapping.ts}` : ""};`);

            if (func.throws) {
                lines.push(this.generateErrorCheck(""));
                if (hasReturnValue) {
                    lines.push(`  return ${resultVarName};`);
                }
            }
        }

        lines.push(`};`);
        return `${lines.join("\n")}\n`;
    }

    private async generateEnums(enumerations: GirEnumeration[]): Promise<string> {
        const sections = enumerations.map((enumeration) => {
            const enumName = toPascalCase(enumeration.name);
            const members = enumeration.members.map((member) => {
                let memberName = toConstantCase(member.name);
                if (/^\d/.test(memberName)) memberName = `_${memberName}`;
                const memberDoc = member.doc ? `${formatDoc(member.doc, "  ").trimEnd()}\n` : "";
                return `${memberDoc}  ${memberName} = ${member.value},`;
            });
            const enumDoc = enumeration.doc ? formatDoc(enumeration.doc) : "";
            return `${enumDoc}export enum ${enumName} {\n${members.join("\n")}\n}`;
        });

        return this.formatCode(`${sections.join("\n\n")}\n`);
    }

    private async generateIndex(fileNames: IterableIterator<string>): Promise<string> {
        const exports = Array.from(fileNames)
            .filter((f) => f !== "index.ts")
            .map((f) => `export * from "./${f.replace(".ts", "")}.js";`);

        return this.formatCode(`${exports.join("\n")}\n`);
    }

    private generateParameterList(parameters: GirParameter[], makeAllOptional = false): string {
        const filteredParams = parameters.filter(
            (p, i) => !isVararg(p) && !this.typeMapper.isClosureTarget(i, parameters),
        );

        const required: string[] = [];
        const optional: string[] = [];

        for (const param of filteredParams) {
            const mapped = this.typeMapper.mapParameter(param);
            const paramName = toValidIdentifier(toCamelCase(param.name));
            const isOptional = makeAllOptional || this.typeMapper.isNullable(param);
            const typeStr = isOptional ? `${mapped.ts} | null` : mapped.ts;
            const paramStr = `${paramName}${isOptional ? "?" : ""}: ${typeStr}`;
            (isOptional ? optional : required).push(paramStr);
        }

        return [...required, ...optional].join(", ");
    }

    private generateCallArguments(parameters: GirParameter[], indent = "      "): string {
        return parameters
            .filter((p, i) => !isVararg(p) && !this.typeMapper.isClosureTarget(i, parameters))
            .map((param) => {
                const mapped = this.typeMapper.mapParameter(param);
                const jsParamName = toValidIdentifier(toCamelCase(param.name));
                const needsPtr = mapped.ffi.type === "gobject" || mapped.ffi.type === "boxed";
                const valueName = needsPtr ? `(${jsParamName} as any)?.id ?? ${jsParamName}` : jsParamName;
                const isOptional = this.typeMapper.isNullable(param);
                const optionalPart = isOptional ? `,\n${indent}    optional: true` : "";
                return `${indent}  {\n${indent}    type: ${this.generateTypeDescriptor(mapped.ffi)},\n${indent}    value: ${valueName}${optionalPart},\n${indent}  }`;
            })
            .join(",\n");
    }

    private generateErrorArgument(indent = "      "): string {
        return `${indent}  {\n${indent}    type: { type: "ref", innerType: { type: "boxed", innerType: "GError", lib: "libglib-2.0.so.0" } },\n${indent}    value: error,\n${indent}  }`;
    }

    private generateErrorCheck(indent = "  "): string {
        this.usesNativeError = true;
        return `${indent}  if (error.value !== null) {
${indent}    throw new NativeError(error.value);
${indent}  }`;
    }

    private generateTypeDescriptor(type: FfiTypeDescriptor): string {
        if (type.type === "int") {
            return `{ type: "int", size: ${type.size}, unsigned: ${type.unsigned} }`;
        }
        if (type.type === "float") {
            return `{ type: "float", size: ${type.size} }`;
        }
        if (type.type === "string") {
            return type.borrowed ? `{ type: "string", borrowed: true }` : `{ type: "string" }`;
        }
        if (type.type === "gobject") {
            return type.borrowed ? `{ type: "gobject", borrowed: true }` : `{ type: "gobject" }`;
        }
        if (type.type === "boxed") {
            const innerType = typeof type.innerType === "string" ? type.innerType : "";
            const lib = this.currentSharedLibrary;
            return type.borrowed
                ? `{ type: "boxed", borrowed: true, innerType: "${innerType}", lib: "${lib}" }`
                : `{ type: "boxed", innerType: "${innerType}", lib: "${lib}" }`;
        }
        if (type.type === "ref" && type.innerType && typeof type.innerType !== "string") {
            return `{ type: "ref", innerType: ${this.generateTypeDescriptor(type.innerType)} }`;
        }
        if (type.type === "array" && type.itemType) {
            const parts = [`type: "array"`, `itemType: ${this.generateTypeDescriptor(type.itemType)}`];
            if (type.listType) {
                parts.push(`listType: "${type.listType}"`);
            }
            if (type.borrowed) {
                parts.push(`borrowed: true`);
            }
            return `{ ${parts.join(", ")} }`;
        }
        if (type.type === "callback") {
            const parts: string[] = [`type: "callback"`];
            if (type.trampoline) {
                parts.push(`trampoline: "${type.trampoline}"`);
            }
            if (type.argTypes) {
                const argTypesStr = type.argTypes.map((t) => this.generateTypeDescriptor(t)).join(", ");
                parts.push(`argTypes: [${argTypesStr}]`);
            }
            if (type.sourceType) {
                parts.push(`sourceType: ${this.generateTypeDescriptor(type.sourceType)}`);
            }
            if (type.resultType) {
                parts.push(`resultType: ${this.generateTypeDescriptor(type.resultType)}`);
            }
            return `{ ${parts.join(", ")} }`;
        }
        return `{ type: "${type.type}" }`;
    }

    private generateImports(currentClassName?: string, parentClassName?: string, parentNamespace?: string): string {
        const nativeImports: string[] = [];
        if (this.usesAlloc) nativeImports.push("alloc");
        if (this.usesRead) nativeImports.push("read");
        if (this.usesWrite) nativeImports.push("write");
        if (this.usesRef) nativeImports.push("Ref");
        if (this.usesType) nativeImports.push("Type");

        const lines: string[] = [];
        if (nativeImports.length > 0) {
            lines.push(`import { ${nativeImports.join(", ")} } from "@gtkx/native";`);
        }
        const ffiImports: string[] = [];
        if (this.usesCall) ffiImports.push("call");
        if (this.usesNativeError) ffiImports.push("NativeError");
        if (this.usesGetObject) ffiImports.push("getObject");
        if (this.usesRegisterType) ffiImports.push("registerType");
        if (ffiImports.length > 0) {
            lines.push(`import { ${ffiImports.join(", ")} } from "@gtkx/ffi";`);
        }
        if (this.usesSignalMeta) {
            lines.push(`import type { SignalMeta } from "../../types.js";`);
        }
        if (this.usedEnums.size > 0) {
            const enumList = Array.from(this.usedEnums).sort().join(", ");
            lines.push(`import { ${enumList} } from "./enums.js";`);
        }

        for (const normalizedRecordName of Array.from(this.usedRecords).sort()) {
            const normalizedCurrentClass = currentClassName ? normalizeClassName(currentClassName) : "";
            const normalizedParentClass = parentClassName ? normalizeClassName(parentClassName) : "";
            if (normalizedRecordName !== normalizedCurrentClass && normalizedRecordName !== normalizedParentClass) {
                const originalName = this.recordNameToFile.get(normalizedRecordName) ?? normalizedRecordName;
                lines.push(`import { ${normalizedRecordName} } from "./${toKebabCase(originalName)}.js";`);
            }
        }

        for (const [interfaceName, originalName] of Array.from(this.usedInterfaces.entries()).sort((a, b) =>
            a[0].localeCompare(b[0]),
        )) {
            const originalFileName = this.interfaceNameToFile.get(interfaceName) ?? originalName;
            lines.push(`import { ${interfaceName} } from "./${toKebabCase(originalFileName)}.js";`);
        }

        for (const [className, originalName] of Array.from(this.usedSameNamespaceClasses.entries()).sort((a, b) =>
            a[0].localeCompare(b[0]),
        )) {
            const normalizedCurrentClass = currentClassName ? normalizeClassName(currentClassName) : "";
            const normalizedParentClass = parentClassName ? normalizeClassName(parentClassName) : "";
            if (
                className !== normalizedCurrentClass &&
                className !== normalizedParentClass &&
                !this.signalClasses.has(className) &&
                !this.usedInterfaces.has(className)
            ) {
                if (this.cyclicReturnTypes.has(className)) {
                    lines.push(`import type { ${className} } from "./${toKebabCase(originalName)}.js";`);
                } else {
                    lines.push(`import { ${className} } from "./${toKebabCase(originalName)}.js";`);
                }
            }
        }

        for (const className of Array.from(this.signalClasses).sort()) {
            if (className !== currentClassName && className !== parentClassName) {
                lines.push(`import { ${className} } from "./${toKebabCase(className)}.js";`);
            }
        }

        const externalNamespaces = new Set<string>();
        for (const usage of this.usedExternalTypes.values()) {
            if (usage.namespace === this.options.namespace) continue;
            externalNamespaces.add(usage.namespace);
        }
        if (this.addGioImport && this.options.namespace !== "Gio") {
            externalNamespaces.add("Gio");
        }
        if (parentNamespace && parentNamespace !== this.options.namespace) {
            externalNamespaces.add(parentNamespace);
        }
        for (const namespace of Array.from(externalNamespaces).sort()) {
            const nsLower = namespace.toLowerCase();
            lines.push(`import * as ${namespace} from "../${nsLower}/index.js";`);
        }

        return lines.length > 0 ? `${lines.join("\n")}\n` : "";
    }

    private async formatCode(code: string): Promise<string> {
        try {
            return await format(code, {
                parser: "typescript",
                ...(this.options.prettierConfig &&
                typeof this.options.prettierConfig === "object" &&
                this.options.prettierConfig !== null
                    ? (this.options.prettierConfig as Record<string, unknown>)
                    : {}),
            });
        } catch (error) {
            console.warn("Failed to format code:", error);
            return code;
        }
    }
}
