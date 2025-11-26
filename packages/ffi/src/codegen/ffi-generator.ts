import type {
    FfiTypeDescriptor,
    GirClass,
    GirConstructor,
    GirEnumeration,
    GirFunction,
    GirInterface,
    GirMethod,
    GirNamespace,
    GirParameter,
    GirProperty,
    GirSignal,
} from "@gtkx/gir";
import { TypeMapper, toCamelCase, toPascalCase } from "@gtkx/gir";
import { format } from "prettier";

/**
 * Configuration options for the FFI code generator.
 */
export interface GeneratorOptions {
    /** Output directory for generated files. */
    outputDir: string;
    /** The namespace being generated (e.g., "Gtk"). */
    namespace: string;
    /** Optional Prettier configuration for formatting output. */
    prettierConfig?: unknown;
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
]);

const METHOD_RENAMES = new Map<string, Map<string, string>>([
    ["IconView", new Map([["setCursor", "setCursorPath"]])],
    ["TreeView", new Map([["setCursor", "setCursorPath"]])],
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
]);

const toKebabCase = (str: string): string => str.replace(/([a-z])([A-Z])/g, "$1-$2").toLowerCase();

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

const normalizeClassName = (name: string): string => (name === "Object" ? "GObject" : toPascalCase(name));

const hasOutParameter = (params: GirParameter[]): boolean =>
    params.some((p) => p.direction === "out" || p.direction === "inout");

const isVararg = (param: GirParameter): boolean => param.name === "..." || param.name === "";

/**
 * Generates TypeScript FFI bindings from GIR namespace definitions.
 * Creates classes, methods, properties, and signal handlers that call
 * native GTK functions through the FFI bridge.
 */
export class CodeGenerator {
    private typeMapper: TypeMapper;
    private usesRef = false;
    private usesCall = false;
    private usesType = false;
    private usedEnums = new Set<string>();
    private signalClasses = new Set<string>();

    /**
     * Creates a new code generator with the given options.
     * @param options - Generator configuration
     */
    constructor(private options: GeneratorOptions) {
        this.typeMapper = new TypeMapper();
    }

    /**
     * Generates TypeScript files for all types in a GIR namespace.
     * @param namespace - The parsed GIR namespace
     * @returns Map of filename to generated TypeScript code
     */
    async generateNamespace(namespace: GirNamespace): Promise<Map<string, string>> {
        const files = new Map<string, string>();

        this.registerEnumsAndBitfields(namespace);
        const classMap = this.buildClassMap(namespace);
        this.attachConstructorFunctions(namespace, classMap);

        const parentClasses = this.buildParentClassSet(classMap);

        for (const iface of namespace.interfaces) {
            files.set(
                `${toKebabCase(iface.name)}.ts`,
                await this.generateInterface(iface, namespace.sharedLibrary, classMap),
            );
        }

        for (const cls of namespace.classes) {
            files.set(
                `${toKebabCase(cls.name)}.ts`,
                await this.generateClass(cls, namespace.sharedLibrary, classMap, parentClasses),
            );
        }

        const standaloneFunctions = this.getStandaloneFunctions(namespace, classMap);
        if (standaloneFunctions.length > 0) {
            files.set("functions.ts", await this.generateFunctions(standaloneFunctions, namespace.sharedLibrary));
        }

        const allEnums = [...namespace.enumerations, ...namespace.bitfields];
        if (allEnums.length > 0) {
            files.set("enums.ts", await this.generateEnums(allEnums));
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

    private buildClassMap(namespace: GirNamespace): Map<string, GirClass> {
        const classMap = new Map<string, GirClass>();
        for (const cls of namespace.classes) {
            classMap.set(cls.name, cls);
        }
        return classMap;
    }

    private buildParentClassSet(classMap: Map<string, GirClass>): Set<string> {
        const parentClasses = new Set<string>();
        for (const cls of classMap.values()) {
            if (cls.parent && classMap.has(cls.parent)) {
                parentClasses.add(cls.parent);
            }
        }
        return parentClasses;
    }

    private attachConstructorFunctions(namespace: GirNamespace, classMap: Map<string, GirClass>): void {
        for (const func of namespace.functions) {
            const match = func.cIdentifier?.match(/^[a-z_]+_([a-z_]+)_new(_.*)?$/);
            if (!match?.[1] || !func.returnType.name) continue;

            const potentialClassName = match[1]
                .split("_")
                .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                .join("");

            const cls = classMap.get(potentialClassName);
            if (cls) {
                cls.constructors.push({
                    name: func.name,
                    cIdentifier: func.cIdentifier,
                    returnType: func.returnType,
                    parameters: func.parameters,
                });
            }
        }
    }

    private getStandaloneFunctions(namespace: GirNamespace, classMap: Map<string, GirClass>): GirFunction[] {
        return namespace.functions.filter((func) => {
            const match = func.cIdentifier?.match(/^[a-z_]+_([a-z_]+)_new(_.*)?$/);
            if (!match?.[1] || !func.returnType.name) return true;

            const potentialClassName = match[1]
                .split("_")
                .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
                .join("");

            return !classMap.has(potentialClassName);
        });
    }

    private resetState(): void {
        this.usesRef = false;
        this.usesCall = false;
        this.usesType = false;
        this.usedEnums.clear();
        this.signalClasses.clear();
        this.typeMapper.setEnumUsageCallback((enumName) => this.usedEnums.add(enumName));
    }

    private async generateClass(
        cls: GirClass,
        sharedLibrary: string,
        classMap: Map<string, GirClass>,
        parentClasses: Set<string>,
    ): Promise<string> {
        this.resetState();

        this.usesRef =
            cls.methods.some((m) => hasOutParameter(m.parameters)) ||
            cls.constructors.some((c) => hasOutParameter(c.parameters));
        this.usesCall = cls.methods.length > 0 || cls.constructors.length > 0 || cls.signals.length > 0;

        const className = normalizeClassName(cls.name);
        const hasParent = !!(cls.parent && classMap.has(cls.parent));
        const parentClassName = cls.parent ? normalizeClassName(cls.parent) : "";
        const extendsClause = hasParent ? ` extends ${parentClassName}` : "";
        const isParentClass = parentClasses.has(cls.name);

        const sections: string[] = [];

        if (hasParent && cls.parent) {
            sections.push(`import { ${parentClassName} } from "./${toKebabCase(cls.parent)}.js";`);
        }
        sections.push("");

        if (cls.doc) {
            sections.push(formatDoc(cls.doc));
        }
        sections.push(`export class ${className}${extendsClause} {`);

        if (!extendsClause) {
            sections.push(`  ptr: unknown;\n`);
        } else if (cls.constructors.length === 0) {
            sections.push(`  ptr: unknown = undefined as any;\n`);
        }

        sections.push(this.generateConstructors(cls, sharedLibrary, hasParent, isParentClass));
        sections.push(this.generateMethods(cls.methods, sharedLibrary, cls.name));
        sections.push(this.generateProperties(cls.properties, cls.methods));

        if (cls.signals.length > 0) {
            const hasConnectMethod = cls.methods.some((m) => toCamelCase(m.name) === "connect");
            sections.push(this.generateSignalConnect(sharedLibrary, cls.signals, hasConnectMethod, classMap));
        }

        sections.push("}");

        const imports = this.generateImports(className, hasParent ? parentClassName : undefined);
        return this.formatCode(imports + sections.join("\n"));
    }

    private generateConstructors(
        cls: GirClass,
        sharedLibrary: string,
        hasParent: boolean,
        isParentClass: boolean,
    ): string {
        if (cls.constructors.length === 0) {
            if (isParentClass && hasParent) {
                return `  constructor(_skipCreate?: boolean) {\n    super(true);\n  }\n`;
            }
            if (isParentClass) {
                return `  constructor(_skipCreate?: boolean) {}\n`;
            }
            if (hasParent) {
                return `  constructor() {\n    super(true);\n  }\n`;
            }
            return "";
        }

        const mainConstructor = cls.constructors.find((c) => !c.parameters.some(isVararg));
        const sections: string[] = [];

        if (mainConstructor) {
            sections.push(this.generateConstructor(mainConstructor, cls.name, sharedLibrary, hasParent, isParentClass));
            for (const ctor of cls.constructors) {
                if (ctor !== mainConstructor) {
                    sections.push(this.generateStaticFactoryMethod(ctor, cls.name, sharedLibrary));
                }
            }
        } else {
            for (const ctor of cls.constructors) {
                sections.push(this.generateStaticFactoryMethod(ctor, cls.name, sharedLibrary));
            }
        }

        return sections.join("\n");
    }

    private generateConstructor(
        ctor: GirConstructor,
        _className: string,
        sharedLibrary: string,
        hasParent: boolean,
        isParentClass: boolean,
    ): string {
        const args = this.generateCallArguments(ctor.parameters);
        const ctorDoc = formatMethodDoc(ctor.doc, ctor.parameters);

        if (isParentClass) {
            const params = this.generateParameterList(ctor.parameters, true);
            const allParams = params ? `_skipCreate?: boolean, ${params}` : "_skipCreate?: boolean";
            return `${ctorDoc}  constructor(${allParams}) {
${hasParent ? "    super(true);\n" : ""}    if (!_skipCreate) this.ptr = call(
      "${sharedLibrary}",
      "${ctor.cIdentifier}",
      [
${args}
      ],
      { type: "gobject", borrowed: true }
    ) as unknown;
  }
`;
        }

        const params = this.generateParameterList(ctor.parameters, true);
        return `${ctorDoc}  constructor(${params}) {
${hasParent ? "    super(true);\n" : ""}    this.ptr = call(
      "${sharedLibrary}",
      "${ctor.cIdentifier}",
      [
${args}
      ],
      { type: "gobject", borrowed: true }
    ) as unknown;
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

        return `${ctorDoc}  static ${methodName}(${params}): ${className} {
    const ptr = call(
      "${sharedLibrary}",
      "${ctor.cIdentifier}",
      [
${args}
      ],
      { type: "gobject", borrowed: true }
    );
    const instance = Object.create(${className}.prototype) as ${className} & { ptr: unknown };
    instance.ptr = ptr;
    return instance;
  }
`;
    }

    private generateMethods(methods: GirMethod[], sharedLibrary: string, className?: string): string {
        const generatedMethods = new Set<string>();
        const sections: string[] = [];

        for (const method of methods) {
            const methodKey = `${toCamelCase(method.name)}:${method.cIdentifier}`;
            if (generatedMethods.has(methodKey)) continue;
            generatedMethods.add(methodKey);
            sections.push(this.generateMethod(method, sharedLibrary, className));
        }

        return sections.join("\n");
    }

    private generateMethod(method: GirMethod, sharedLibrary: string, className?: string): string {
        let methodName = toCamelCase(method.name);
        if (className) {
            const renames = METHOD_RENAMES.get(className);
            const renamed = renames?.get(methodName);
            if (renamed) {
                methodName = renamed;
            }
        }

        const params = this.generateParameterList(method.parameters);
        const returnTypeMapping = this.typeMapper.mapType(method.returnType, true);
        const tsReturnType = returnTypeMapping.ts === "void" ? "void" : returnTypeMapping.ts;
        const returnTypeAnnotation = tsReturnType !== "void" ? `: ${tsReturnType}` : "";

        const hasResultParam = method.parameters.some((p) => toValidIdentifier(toCamelCase(p.name)) === "result");
        const resultVarName = hasResultParam ? "_result" : "result";

        const needsCast = returnTypeMapping.ts !== "void" && returnTypeMapping.ts !== "unknown";
        const hasReturnValue = returnTypeMapping.ts !== "void";

        const lines: string[] = [];
        const methodDoc = formatMethodDoc(method.doc, method.parameters);
        if (methodDoc) {
            lines.push(methodDoc.trimEnd());
        }
        lines.push(`  ${methodName}(${params})${returnTypeAnnotation} {`);

        if (method.throws) {
            lines.push(`    const error = { value: null as unknown };`);
        }

        const callPrefix = method.throws
            ? hasReturnValue
                ? `const ${resultVarName} = `
                : ""
            : hasReturnValue
              ? "return "
              : "";

        const args = this.generateCallArguments(method.parameters);
        const errorArg = method.throws ? this.generateErrorArgument() : "";
        const allArgs = errorArg ? args + (args ? ",\n" : "") + errorArg : args;

        lines.push(`    ${callPrefix}call(
      "${sharedLibrary}",
      "${method.cIdentifier}",
      [
        {
          type: { type: "gobject" },
          value: this.ptr,
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

        lines.push(`  }`);
        return `${lines.join("\n")}\n`;
    }

    private generateProperties(properties: GirProperty[], methods: GirMethod[]): string {
        const methodNames = new Set(methods.map((m) => toCamelCase(m.name)));
        const sections: string[] = [];

        for (const property of properties) {
            if (!property.readable && !property.writable) continue;
            const propertyName = toValidIdentifier(toCamelCase(property.name));
            if (methodNames.has(propertyName)) continue;
            sections.push(this.generateProperty(property));
        }

        return sections.join("\n");
    }

    private generateProperty(property: GirProperty): string {
        const propertyName = toValidIdentifier(toCamelCase(property.name));
        const typeMapping = this.typeMapper.mapType(property.type);
        const lines: string[] = [];

        if (property.readable) {
            if (property.doc) {
                lines.push(formatDoc(property.doc, "  ").trimEnd());
            }
            lines.push(`  get ${propertyName}(): ${typeMapping.ts} {
    throw new Error("Property getters not yet implemented");
  }
`);
        }

        if (property.writable && !property.constructOnly) {
            if (!property.readable && property.doc) {
                lines.push(formatDoc(property.doc, "  ").trimEnd());
            }
            lines.push(`  set ${propertyName}(_value: ${typeMapping.ts}) {
    throw new Error("Property setters not yet implemented");
  }
`);
        }

        return lines.join("\n");
    }

    private extractSignalParamClass(param: GirParameter, classMap: Map<string, GirClass>): string | undefined {
        const typeName = param.type.name;
        if (!typeName) return undefined;

        if (typeName.includes(".")) {
            const [ns, className] = typeName.split(".", 2);
            if (ns === this.options.namespace && className) {
                return normalizeClassName(className);
            }
            return undefined;
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
    ): string {
        const methodName = hasConnectMethod ? "on" : "connect";

        const savedCallback = this.typeMapper.getEnumUsageCallback();
        this.typeMapper.setEnumUsageCallback(null);

        const signalMetadata = signals.map((signal) => {
            const paramEntries = (signal.parameters ?? []).map((param) => {
                const ffiType = JSON.stringify(this.typeMapper.mapType(param.type).ffi);
                const className = this.extractSignalParamClass(param, classMap);
                if (className) {
                    this.signalClasses.add(className);
                    return `{ type: ${ffiType}, cls: ${className} }`;
                }
                return `{ type: ${ffiType} }`;
            });
            return `    "${signal.name}": [${paramEntries.join(", ")}]`;
        });

        this.typeMapper.setEnumUsageCallback(savedCallback);

        if (signalMetadata.length > 0) {
            this.usesType = true;
        }

        const signalMapCode =
            signalMetadata.length > 0
                ? `const signalMeta: Record<string, { type: Type; cls?: { prototype: object } }[]> = {\n${signalMetadata.join(",\n")}\n  };
    const meta = signalMeta[signal];
    const argTypes = meta?.map((m) => m.type);`
                : `const meta = undefined;\n    const argTypes = undefined;`;

        const wrapperCode = `const wrappedHandler = (...args: unknown[]) => {
      if (!meta) return handler(...args);
      const wrapped = meta.map((m, i) => {
        if (m.cls && args[i] != null) {
          const inst = Object.create(m.cls.prototype) as { ptr: unknown };
          inst.ptr = args[i];
          return inst;
        }
        return args[i];
      });
      return handler(...wrapped);
    };`;

        return `  ${methodName}(
    signal: string,
    handler: (...args: unknown[]) => unknown,
    after = false
  ): number {
    ${signalMapCode}
    ${wrapperCode}
    return call(
      "${sharedLibrary}",
      "g_signal_connect_closure",
      [
        { type: { type: "gobject" }, value: this.ptr },
        { type: { type: "string" }, value: signal },
        { type: { type: "callback", argTypes }, value: wrappedHandler },
        { type: { type: "boolean" }, value: after },
      ],
      { type: "int", size: 64, unsigned: true }
    ) as number;
  }
`;
    }

    private async generateInterface(
        iface: GirInterface,
        sharedLibrary: string,
        classMap: Map<string, GirClass>,
    ): Promise<string> {
        this.resetState();

        this.usesRef = iface.methods.some((m) => hasOutParameter(m.parameters));
        this.usesCall = iface.methods.length > 0 || iface.signals.length > 0;

        const interfaceName = toPascalCase(iface.name);
        const sections: string[] = [];

        if (iface.doc) {
            sections.push(formatDoc(iface.doc));
        }
        sections.push(`export abstract class ${interfaceName} {`);
        sections.push(`  protected abstract ptr: unknown;\n`);
        sections.push(this.generateMethods(iface.methods, sharedLibrary, iface.name));
        sections.push(this.generateProperties(iface.properties, iface.methods));

        if (iface.signals.length > 0) {
            const hasConnectMethod = iface.methods.some((m) => toCamelCase(m.name) === "connect");
            sections.push(this.generateSignalConnect(sharedLibrary, iface.signals, hasConnectMethod, classMap));
        }

        sections.push("}");

        const imports = this.generateImports(interfaceName);
        return this.formatCode(imports + sections.join("\n"));
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
        const tsReturnType = returnTypeMapping.ts === "void" ? "" : `: ${returnTypeMapping.ts}`;

        const hasResultParam = func.parameters.some((p) => toValidIdentifier(toCamelCase(p.name)) === "result");
        const resultVarName = hasResultParam ? "_result" : "result";

        const needsCast = returnTypeMapping.ts !== "void" && returnTypeMapping.ts !== "unknown";
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

        const callPrefix = func.throws
            ? hasReturnValue
                ? `const ${resultVarName} = `
                : ""
            : hasReturnValue
              ? "return "
              : "";

        const args = this.generateCallArguments(func.parameters, "  ");
        const errorArg = func.throws ? this.generateErrorArgument("  ") : "";
        const allArgs = errorArg ? args + (args ? ",\n" : "") + errorArg : args;

        lines.push(`  ${callPrefix}call("${sharedLibrary}", "${func.cIdentifier}", [
${allArgs ? `${allArgs},` : ""}
  ], ${this.generateTypeDescriptor(returnTypeMapping.ffi)})${needsCast ? ` as ${returnTypeMapping.ts}` : ""};`);

        if (func.throws) {
            lines.push(this.generateErrorCheck(""));
            if (hasReturnValue) {
                lines.push(`  return ${resultVarName};`);
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
        const filteredParams = parameters.filter((p) => !isVararg(p));

        const required: string[] = [];
        const optional: string[] = [];

        for (const param of filteredParams) {
            const mapped = this.typeMapper.mapParameter(param);
            const paramName = toValidIdentifier(toCamelCase(param.name));
            const isOptional = makeAllOptional || this.typeMapper.isNullable(param);
            const paramStr = `${paramName}${isOptional ? "?" : ""}: ${mapped.ts}`;

            (isOptional ? optional : required).push(paramStr);
        }

        return [...required, ...optional].join(", ");
    }

    private generateCallArguments(parameters: GirParameter[], indent = "      "): string {
        return parameters
            .filter((p) => !isVararg(p))
            .map((param) => {
                const mapped = this.typeMapper.mapParameter(param);
                const jsParamName = toValidIdentifier(toCamelCase(param.name));
                return `${indent}  {\n${indent}    type: ${this.generateTypeDescriptor(mapped.ffi)},\n${indent}    value: ${jsParamName},\n${indent}  }`;
            })
            .join(",\n");
    }

    private generateErrorArgument(indent = "      "): string {
        return `${indent}  {\n${indent}    type: { type: "ref", innerType: { type: "gobject" } },\n${indent}    value: error,\n${indent}  }`;
    }

    private generateErrorCheck(indent = "  "): string {
        return `${indent}  if (error.value !== null) {
${indent}    const jsError = new Error("GLib Error occurred");
${indent}    (jsError as any).gError = error.value;
${indent}    throw jsError;
${indent}  }`;
    }

    private generateTypeDescriptor(type: FfiTypeDescriptor): string {
        if (type.type === "int") {
            return `{ type: "int", size: ${type.size}, unsigned: ${type.unsigned} }`;
        }
        if (type.type === "float") {
            return `{ type: "float", size: ${type.size} }`;
        }
        if (type.type === "gobject") {
            return type.borrowed ? `{ type: "gobject", borrowed: true }` : `{ type: "gobject" }`;
        }
        if (type.type === "ref" && type.innerType) {
            return `{ type: "ref", innerType: ${this.generateTypeDescriptor(type.innerType)} }`;
        }
        if (type.type === "array" && type.itemType) {
            return `{ type: "array", itemType: ${this.generateTypeDescriptor(type.itemType)} }`;
        }
        return `{ type: "${type.type}" }`;
    }

    private generateImports(currentClassName?: string, parentClassName?: string): string {
        const nativeImports: string[] = [];
        if (this.usesCall) nativeImports.push("call");
        if (this.usesRef) nativeImports.push("Ref");
        if (this.usesType) nativeImports.push("Type");

        const lines: string[] = [];
        if (nativeImports.length > 0) {
            lines.push(`import { ${nativeImports.join(", ")} } from "@gtkx/native";`);
        }
        if (this.usedEnums.size > 0) {
            const enumList = Array.from(this.usedEnums).sort().join(", ");
            lines.push(`import { ${enumList} } from "./enums.js";`);
        }

        for (const className of Array.from(this.signalClasses).sort()) {
            if (className !== currentClassName && className !== parentClassName) {
                lines.push(`import { ${className} } from "./${toKebabCase(className)}.js";`);
            }
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
