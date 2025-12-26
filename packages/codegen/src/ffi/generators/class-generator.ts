import type {
    GirClass,
    GirConstructor,
    GirFunction,
    GirInterface,
    GirMethod,
    GirNamespace,
    GirParameter,
    GirSignal,
    TypeMapper,
} from "@gtkx/gir";
import { normalizeClassName, toCamelCase, toPascalCase, toValidIdentifier } from "@gtkx/gir";
import type { GenerationContext } from "../generation-context.js";
import { parseParentReference } from "../utils/helpers.js";
import { BaseGenerator, type GeneratorOptions } from "./base-generator.js";
import { SignalGenerator } from "./signal-generator.js";

export class ClassGenerator extends BaseGenerator {
    private signalGenerator: SignalGenerator;
    private cyclicReturnTypes = new Set<string>();

    constructor(typeMapper: TypeMapper, ctx: GenerationContext, options: GeneratorOptions) {
        super(typeMapper, ctx, options);
        this.signalGenerator = new SignalGenerator(typeMapper, ctx, options);
    }

    async generateClass(
        cls: GirClass,
        sharedLibrary: string,
        classMap: Map<string, GirClass>,
        interfaceMap: Map<string, GirInterface>,
    ): Promise<string | null> {
        if (cls.constructors.length > 0) {
            const hasAnySupportedConstructor = cls.constructors.some(
                (c) => !this.hasUnsupportedCallbacks(c.parameters),
            );
            if (!hasAnySupportedConstructor) {
                return null;
            }
        }

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
        const classMethodNames = new Set(cls.methods.map((m) => m.name));
        const className = normalizeClassName(cls.name, this.options.namespace);

        const filteredClassMethods = cls.methods.filter((m) => {
            const needsRename = parentMethodNames.has(m.name) || (m.name === "connect" && cls.parent);
            if (!needsRename) return true;
            const pascalMethodName = toPascalCase(m.name);
            const renamedMethod = `${className.charAt(0).toLowerCase()}${className.slice(1)}${pascalMethodName}`;
            this.ctx.methodRenames.set(m.cIdentifier, renamedMethod);
            return true;
        });

        const seenInterfaceMethodNames = new Set<string>();
        const interfaceMethodsByNamespace = new Map<string, GirMethod[]>();
        for (const ifaceName of cls.implements) {
            let iface: GirInterface | undefined;
            let sourceNamespace = this.options.namespace;
            if (ifaceName.includes(".")) {
                const [ns, ifaceClassName] = ifaceName.split(".", 2);
                const ifaceNs = (this.options.allNamespaces as Map<string, GirNamespace> | undefined)?.get(ns ?? "");
                if (ifaceNs && ifaceClassName) {
                    iface = ifaceNs.interfaces.find((i) => i.name === ifaceClassName);
                    sourceNamespace = ns ?? this.options.namespace;
                }
            } else {
                iface = interfaceMap.get(ifaceName);
            }
            if (!iface) continue;

            for (const method of iface.methods) {
                if (classMethodNames.has(method.name) || parentMethodNames.has(method.name)) continue;

                if (seenInterfaceMethodNames.has(method.name)) {
                    const pascalMethodName = toPascalCase(method.name);
                    const ifaceNamePascal = toPascalCase(iface.name);
                    const renamedMethod = `${ifaceNamePascal.charAt(0).toLowerCase()}${ifaceNamePascal.slice(1)}${pascalMethodName}`;
                    this.ctx.methodRenames.set(method.cIdentifier, renamedMethod);
                } else {
                    seenInterfaceMethodNames.add(method.name);
                }

                if (!interfaceMethodsByNamespace.has(sourceNamespace)) {
                    interfaceMethodsByNamespace.set(sourceNamespace, []);
                }
                interfaceMethodsByNamespace.get(sourceNamespace)?.push(method);
            }
        }
        const interfaceMethods = Array.from(interfaceMethodsByNamespace.values()).flat();

        const syncMethods = filteredClassMethods.filter((m) => !asyncMethods.has(m.name) && !finishMethods.has(m.name));
        const syncInterfaceMethods = interfaceMethods.filter(
            (m) => !asyncMethods.has(m.name) && !finishMethods.has(m.name),
        );

        this.ctx.usesRef =
            syncMethods.some((m) => this.hasRefParameter(m.parameters)) ||
            cls.constructors.some((c) => this.hasRefParameter(c.parameters)) ||
            cls.functions.some((f) => this.hasRefParameter(f.parameters)) ||
            syncInterfaceMethods.some((m) => this.hasRefParameter(m.parameters));

        const mainConstructor = cls.constructors.find((c) => !c.parameters.some((p) => this.isVararg(p)));
        const hasMainConstructorWithParent = mainConstructor && !!cls.parent;
        const hasGObjectNewConstructor = !mainConstructor && !!cls.parent && !!cls.glibGetType && !cls.abstract;
        const hasStaticFactoryMethods =
            cls.constructors.some((c) => c !== mainConstructor) || (cls.constructors.length > 0 && !cls.parent);
        const { signals: allSignals, hasCrossNamespaceParent } = this.collectAllSignals(cls, classMap, interfaceMap);
        const hasSignalConnect = allSignals.length > 0 || hasCrossNamespaceParent;

        this.ctx.usesCall =
            filteredClassMethods.length > 0 ||
            cls.functions.length > 0 ||
            interfaceMethods.length > 0 ||
            hasMainConstructorWithParent ||
            hasGObjectNewConstructor ||
            hasStaticFactoryMethods ||
            hasSignalConnect;

        const parentInfo = parseParentReference(cls.parent, classMap, this.options.namespace);
        const implementsClause = "";

        const sections: string[] = [];

        if (parentInfo.importStatement && !parentInfo.isCrossNamespace) {
            sections.push(parentInfo.importStatement);
        }
        sections.push("");

        if (cls.doc) {
            sections.push(this.formatDoc(cls.doc));
        }
        sections.push(`export class ${className}${parentInfo.extendsClause}${implementsClause} {`);

        if (cls.glibTypeName) {
            const override = parentInfo.hasParent ? "override " : "";
            sections.push(`  static ${override}readonly glibTypeName: string = "${cls.glibTypeName}";`);
            sections.push(`  static ${override}readonly objectType = "gobject" as const;\n`);
        }

        if (!parentInfo.hasParent) {
            this.ctx.usesNativeObject = true;
        }

        sections.push(this.generateConstructors(cls, sharedLibrary, parentInfo.hasParent));
        sections.push(this.generateStaticFunctions(cls.functions, sharedLibrary, className));
        sections.push(this.generateMethods(filteredClassMethods, sharedLibrary, cls.name));

        if (interfaceMethods.length > 0) {
            for (const [sourceNamespace, methods] of interfaceMethodsByNamespace) {
                if (sourceNamespace !== this.options.namespace && this.options.typeRegistry) {
                    this.typeMapper.setTypeRegistry(this.options.typeRegistry, sourceNamespace);
                    this.typeMapper.setForceExternalNamespace(sourceNamespace);
                    sections.push(this.generateMethods(methods, sharedLibrary, className));
                    this.typeMapper.setForceExternalNamespace(null);
                    this.typeMapper.setTypeRegistry(this.options.typeRegistry, this.options.namespace);
                } else {
                    sections.push(this.generateMethods(methods, sharedLibrary, className));
                }
            }
        }

        let signalMetaConstant = "";
        if (hasSignalConnect) {
            const signalConnect = this.signalGenerator.generateSignalConnect(
                sharedLibrary,
                allSignals,
                classMap,
                className,
            );
            signalMetaConstant = signalConnect.moduleLevel;
            sections.push(signalConnect.method);
        }

        sections.push("}");

        if (cls.glibTypeName) {
            this.ctx.usesRegisterNativeClass = true;
            sections.push(`\nregisterNativeClass(${className});`);
        }

        if (signalMetaConstant) {
            const classDefIndex = sections.findIndex((s) => s.startsWith("export class "));
            if (classDefIndex !== -1) {
                sections.splice(classDefIndex, 0, signalMetaConstant);
            }
        }

        return sections.join("\n");
    }

    private generateConstructors(cls: GirClass, sharedLibrary: string, hasParent: boolean): string {
        const supportedConstructors = cls.constructors.filter((c) => !this.hasUnsupportedCallbacks(c.parameters));
        const mainConstructor = supportedConstructors.find((c) => !c.parameters.some((p) => this.isVararg(p)));
        const sections: string[] = [];

        if (mainConstructor && hasParent) {
            sections.push(this.generateConstructorWithFlag(mainConstructor, sharedLibrary));
            for (const ctor of supportedConstructors) {
                if (ctor !== mainConstructor) {
                    sections.push(this.generateStaticFactoryMethod(ctor, cls.name, sharedLibrary));
                }
            }
        } else {
            for (const ctor of supportedConstructors) {
                sections.push(this.generateStaticFactoryMethod(ctor, cls.name, sharedLibrary));
            }

            if (hasParent && cls.glibGetType && !cls.abstract) {
                sections.push(this.generateGObjectNewConstructorWithFlag(cls.glibGetType, sharedLibrary));
            } else if (hasParent) {
                sections.push(`  constructor() {\n    super();\n  }\n`);
            } else {
                sections.push(`  constructor() {\n    super();\n    this.create();\n  }\n`);
                sections.push(`  protected create() {}\n`);
            }
        }

        return sections.join("\n");
    }

    private generateConstructorWithFlag(ctor: GirConstructor, sharedLibrary: string): string {
        this.ctx.usesInstantiating = true;
        const ctorDoc = this.formatMethodDoc(ctor.doc, ctor.parameters);
        const params = this.generateParameterList(ctor.parameters);
        const args = this.generateCallArguments(ctor.parameters);
        const docComment = ctorDoc ? `${ctorDoc.trimEnd()}\n` : "";

        return `${docComment}  constructor(${params}) {
    if (!isInstantiating) {
      setInstantiating(true);
      // @ts-ignore
      super();
      setInstantiating(false);
      this.id = call(
        "${sharedLibrary}",
        "${ctor.cIdentifier}",
        [
${args ? `${args},` : ""}
        ],
        { type: "gobject", borrowed: true }
      );
    } else {
      // @ts-ignore
      super();
    }
  }
`;
    }

    private generateGObjectNewConstructorWithFlag(getTypeFunc: string, sharedLibrary: string): string {
        this.ctx.usesInstantiating = true;
        return `  constructor() {
    if (!isInstantiating) {
      setInstantiating(true);
      // @ts-ignore
      super();
      setInstantiating(false);
      const gtype = call(
        "${sharedLibrary}",
        "${getTypeFunc}",
        [],
        { type: "int", size: 64, unsigned: true }
      );
      this.id = call(
        "libgobject-2.0.so.0",
        "g_object_new",
        [
          { type: { type: "int", size: 64, unsigned: true }, value: gtype },
          { type: { type: "null" }, value: null },
        ],
        { type: "gobject", borrowed: true }
      );
    } else {
      // @ts-ignore
      super();
    }
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
        const ctorDoc = this.formatMethodDoc(ctor.doc, ctor.parameters);
        const borrowed = ctor.returnType.transferOwnership !== "full";

        const errorArg = ctor.throws ? this.generateErrorArgument() : "";
        const allArgs = errorArg ? args + (args ? ",\n" : "") + errorArg : args;

        this.ctx.usesGetNativeObject = true;

        const lines: string[] = [];
        lines.push(`${ctorDoc}  static ${methodName}(${params}): ${className} {`);
        if (ctor.throws) {
            lines.push(`    const error = { value: null as unknown };`);
        }
        lines.push(`    const ptr = call(
      "${sharedLibrary}",
      "${ctor.cIdentifier}",
      [
${allArgs}
      ],
      { type: "gobject", borrowed: ${borrowed} }
    );`);
        if (ctor.throws) {
            lines.push(this.generateErrorCheck());
        }
        lines.push(`    return getNativeObject(ptr) as ${className};`);
        lines.push(`  }`);
        return `${lines.join("\n")}\n`;
    }

    generateStaticFunctions(functions: GirFunction[], sharedLibrary: string, className: string): string {
        const supportedFunctions = functions.filter((f) => !this.hasUnsupportedCallbacks(f.parameters));
        const sections: string[] = [];

        for (const func of supportedFunctions) {
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

        const gtkAllocatesRefs = this.identifyGtkAllocatesRefs(func.parameters);

        const lines: string[] = [];
        const funcDoc = this.formatMethodDoc(func.doc, func.parameters);
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
            this.ctx.usesGetNativeObject = true;
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
            lines.push(...this.generateRefRewrapCode(gtkAllocatesRefs));
            lines.push(`    return getNativeObject(ptr) as ${className};`);
        } else {
            const hasRefRewrap = gtkAllocatesRefs.length > 0;
            const needsResultVar = func.throws || hasRefRewrap;
            const callPrefix = needsResultVar
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
            }

            lines.push(...this.generateRefRewrapCode(gtkAllocatesRefs));

            if (needsResultVar && hasReturnValue) {
                lines.push(`    return ${resultVarName};`);
            }
        }

        lines.push(`  }`);
        return `${lines.join("\n")}\n`;
    }

    generateMethods(methods: GirMethod[], sharedLibrary: string, className?: string, isRecord = false): string {
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

            if (this.hasUnsupportedCallbacks(method.parameters)) {
                continue;
            }

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
        _className?: string,
    ): string | null {
        if (!this.hasAsyncCallback(method)) return null;

        const finishMethod = this.findFinishMethod(method, allMethods);
        if (!finishMethod) return null;

        const paramsWithoutCallback = method.parameters.filter(
            (p, i) =>
                !this.isVararg(p) &&
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

        const dynamicRename = this.ctx.methodRenames.get(method.cIdentifier);
        const camelName = toCamelCase(method.name);
        const methodName = dynamicRename ?? camelName;

        const params = paramsWithoutCallback
            .map((p) => {
                const mapped = this.typeMapper.mapParameter(p);
                const paramName = toValidIdentifier(toCamelCase(p.name));
                const isOptional = this.typeMapper.isNullable(p);
                return `${paramName}${isOptional ? "?" : ""}: ${mapped.ts}`;
            })
            .join(", ");

        const finishParams = finishMethod.parameters.filter((p) => !this.isVararg(p));
        const outputParams = finishParams.filter(
            (p) => p.direction === "out" || (p.type.name !== "Gio.AsyncResult" && p.direction !== "in"),
        );

        const returnTypeMapping = this.typeMapper.mapType(finishMethod.returnType, true);
        const mainReturnType = returnTypeMapping.ts;
        const hasMainReturn = mainReturnType !== "void";
        const isNullable = finishMethod.returnType.nullable === true;

        this.ctx.addGioImport = true;

        const promiseType = this.buildAsyncReturnType(hasMainReturn, mainReturnType, outputParams, isNullable);

        const lines: string[] = [];
        lines.push(`  /**`);
        lines.push(`   * Promise-based version of ${methodName}.`);
        if (method.doc) {
            const docLines = this.sanitizeDoc(method.doc).split("\n").slice(0, 3);
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
        const isInterface = returnTypeMapping.kind === "interface";
        const needsGObjectWrap =
            returnTypeMapping.ffi.type === "gobject" && returnTypeMapping.ts !== "unknown" && !isInterface;
        const needsBoxedWrap =
            returnTypeMapping.ffi.type === "boxed" && returnTypeMapping.ts !== "unknown" && !isInterface;
        const needsGVariantWrap = returnTypeMapping.ffi.type === "gvariant" && returnTypeMapping.ts !== "unknown";
        const needsInterfaceWrap =
            returnTypeMapping.ffi.type === "gobject" && returnTypeMapping.ts !== "unknown" && isInterface;
        const needsObjectWrap = needsGObjectWrap || needsBoxedWrap || needsGVariantWrap || needsInterfaceWrap;

        const lines: string[] = [];

        for (const param of outputParams) {
            const paramName = toValidIdentifier(toCamelCase(param.name));
            lines.push(`      const ${paramName}Ref = { value: null as unknown };`);
        }

        const nonCallbackParams = method.parameters.filter(
            (p, i) =>
                !this.isVararg(p) &&
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
            this.ctx.usesNativeError = true;
        }

        if (outputParams.length === 0) {
            if (hasMainReturn) {
                if (needsBoxedWrap || needsGVariantWrap || needsInterfaceWrap) {
                    this.ctx.usesGetNativeObject = true;
                    if (isNullable) {
                        lines.push(`          if (ptr === null) { resolve(null); return; }`);
                    }
                    lines.push(`          resolve(getNativeObject(ptr, ${finishReturnType.ts})!);`);
                } else if (needsGObjectWrap) {
                    this.ctx.usesGetNativeObject = true;
                    if (isNullable) {
                        lines.push(`          if (ptr === null) { resolve(null); return; }`);
                    }
                    lines.push(`          resolve(getNativeObject(ptr) as ${finishReturnType.ts});`);
                } else {
                    lines.push(`          resolve(result);`);
                }
            } else {
                lines.push(`          resolve();`);
            }
        } else {
            const resolveFields: string[] = [];
            if (hasMainReturn) {
                if (needsBoxedWrap || needsGVariantWrap || needsInterfaceWrap) {
                    this.ctx.usesGetNativeObject = true;
                    if (isNullable) {
                        lines.push(
                            `          const result = ptr === null ? null : getNativeObject(ptr, ${finishReturnType.ts})!;`,
                        );
                    } else {
                        lines.push(`          const result = getNativeObject(ptr, ${finishReturnType.ts})!;`);
                    }
                } else if (needsGObjectWrap) {
                    this.ctx.usesGetNativeObject = true;
                    if (isNullable) {
                        lines.push(
                            `          const result = (ptr === null ? null : getNativeObject(ptr)) as ${finishReturnType.ts} | null;`,
                        );
                    } else {
                        lines.push(`          const result = getNativeObject(ptr) as ${finishReturnType.ts};`);
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
            .filter((p) => !this.isVararg(p))
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
        const dynamicRename = this.ctx.methodRenames.get(method.cIdentifier);
        const camelName = toCamelCase(method.name);
        const methodName = dynamicRename ?? camelName;

        const params = this.generateParameterList(method.parameters);
        const returnTypeMapping = this.typeMapper.mapType(method.returnType, true);
        const isNullable = method.returnType.nullable === true;
        const baseReturnType = returnTypeMapping.ts === "void" ? "void" : returnTypeMapping.ts;
        const tsReturnType = isNullable && baseReturnType !== "void" ? `${baseReturnType} | null` : baseReturnType;
        const returnTypeAnnotation = tsReturnType !== "void" ? `: ${tsReturnType}` : "";

        const hasResultParam = method.parameters.some((p) => toValidIdentifier(toCamelCase(p.name)) === "result");
        const resultVarName = hasResultParam ? "_result" : "result";

        const needsGObjectWrap =
            returnTypeMapping.ffi.type === "gobject" &&
            baseReturnType !== "unknown" &&
            returnTypeMapping.kind !== "interface";
        const needsBoxedWrap =
            returnTypeMapping.ffi.type === "boxed" &&
            baseReturnType !== "unknown" &&
            returnTypeMapping.kind !== "interface";
        const needsGVariantWrap = returnTypeMapping.ffi.type === "gvariant" && baseReturnType !== "unknown";
        const needsInterfaceWrap =
            returnTypeMapping.ffi.type === "gobject" &&
            baseReturnType !== "unknown" &&
            returnTypeMapping.kind === "interface";
        const needsObjectWrap = needsGObjectWrap || needsBoxedWrap || needsGVariantWrap || needsInterfaceWrap;
        const needsArrayWrap =
            returnTypeMapping.ffi.type === "array" &&
            returnTypeMapping.ffi.itemType?.type === "gobject" &&
            baseReturnType.endsWith("[]");
        const hasReturnValue = returnTypeMapping.ts !== "void";

        const gtkAllocatesRefs = this.identifyGtkAllocatesRefs(method.parameters);

        const selfTypeDescriptor =
            isRecord && className
                ? `{ type: "boxed", borrowed: true, innerType: "${className}", lib: "${sharedLibrary}" }`
                : `{ type: "gobject" }`;

        const lines: string[] = [];
        const methodDoc = this.formatMethodDoc(method.doc, method.parameters);
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
            lines.push(...this.generateRefRewrapCode(gtkAllocatesRefs));
            if (isNullable) {
                lines.push(`    if (ptr === null) return null;`);
            }
            if (isCyclic) {
                lines.push(`    return { id: ptr } as unknown as ${baseReturnType};`);
            } else if (needsBoxedWrap || needsGVariantWrap || needsInterfaceWrap) {
                this.ctx.usesGetNativeObject = true;
                lines.push(`    return getNativeObject(ptr, ${baseReturnType})!;`);
            } else {
                this.ctx.usesGetNativeObject = true;
                lines.push(`    return getNativeObject(ptr) as ${baseReturnType};`);
            }
        } else if (needsArrayWrap && hasReturnValue) {
            const elementType = baseReturnType.slice(0, -2);
            this.ctx.usesGetNativeObject = true;
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
            lines.push(...this.generateRefRewrapCode(gtkAllocatesRefs));
            lines.push(`    return ptrs.map(ptr => getNativeObject(ptr) as ${elementType});`);
        } else {
            const hasRefRewrap = gtkAllocatesRefs.length > 0;
            const needsResultVar = method.throws || hasRefRewrap;
            const callPrefix = needsResultVar
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
            }
            lines.push(...this.generateRefRewrapCode(gtkAllocatesRefs));
            if (needsResultVar && hasReturnValue) {
                lines.push(`    return ${resultVarName};`);
            }
        }

        lines.push(`  }`);
        return `${lines.join("\n")}\n`;
    }

    private collectAllSignals(
        cls: GirClass,
        classMap: Map<string, GirClass>,
        interfaceMap: Map<string, GirInterface>,
    ): { signals: GirSignal[]; hasCrossNamespaceParent: boolean } {
        const allSignals: GirSignal[] = [...cls.signals];
        const seenNames = new Set(cls.signals.map((s) => s.name));

        for (const ifaceName of cls.implements) {
            let iface: GirInterface | undefined;
            if (ifaceName.includes(".")) {
                const [ns, ifaceClassName] = ifaceName.split(".", 2);
                const ifaceNs = (this.options.allNamespaces as Map<string, GirNamespace> | undefined)?.get(ns ?? "");
                if (ifaceNs && ifaceClassName) {
                    iface = ifaceNs.interfaces.find((i) => i.name === ifaceClassName);
                }
            } else {
                iface = interfaceMap.get(ifaceName);
            }
            if (!iface) continue;

            for (const signal of iface.signals) {
                if (!seenNames.has(signal.name)) {
                    allSignals.push(signal);
                    seenNames.add(signal.name);
                }
            }
        }

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

    private collectParentMethodNames(
        cls: GirClass,
        classMap: Map<string, GirClass>,
        interfaceMap: Map<string, GirInterface>,
    ): Set<string> {
        const names = new Set<string>();
        const visited = new Set<string>();
        let parentRef = cls.parent;
        let currentClassMap = classMap;
        let currentInterfaceMap = interfaceMap;

        while (parentRef && !visited.has(parentRef)) {
            visited.add(parentRef);

            let current: GirClass | undefined;

            if (parentRef.includes(".")) {
                const [ns, className] = parentRef.split(".", 2);
                const parentNs = (this.options.allNamespaces as Map<string, GirNamespace> | undefined)?.get(ns ?? "");
                if (parentNs && className) {
                    current = parentNs.classes.find((c) => c.name === className);
                    currentClassMap = new Map(parentNs.classes.map((c) => [c.name, c]));
                    currentInterfaceMap = new Map(parentNs.interfaces.map((i) => [i.name, i]));
                }
            } else {
                current = currentClassMap.get(parentRef);
            }

            if (!current) break;

            for (const method of current.methods) {
                names.add(method.name);
            }

            for (const ifaceName of current.implements) {
                let iface: GirInterface | undefined;
                if (ifaceName.includes(".")) {
                    const [ns, ifaceClassName] = ifaceName.split(".", 2);
                    const ifaceNs = (this.options.allNamespaces as Map<string, GirNamespace> | undefined)?.get(
                        ns ?? "",
                    );
                    if (ifaceNs && ifaceClassName) {
                        iface = ifaceNs.interfaces.find((i) => i.name === ifaceClassName);
                    }
                } else {
                    iface = currentInterfaceMap.get(ifaceName);
                }

                if (iface) {
                    for (const method of iface.methods) {
                        names.add(method.name);
                    }
                }
            }

            parentRef = current.parent;
        }

        return names;
    }

    private computeCyclicReturnTypes(cls: GirClass, classMap: Map<string, GirClass>): Set<string> {
        const cyclic = new Set<string>();
        for (const method of cls.methods) {
            const returnTypeName = method.returnType.name;
            if (returnTypeName && classMap.has(returnTypeName)) {
                if (this.wouldCreateCycle(cls.name, returnTypeName, classMap)) {
                    cyclic.add(normalizeClassName(returnTypeName, this.options.namespace));
                }
            }
        }
        for (const func of cls.functions) {
            const returnTypeName = func.returnType.name;
            if (returnTypeName && classMap.has(returnTypeName)) {
                if (this.wouldCreateCycle(cls.name, returnTypeName, classMap)) {
                    cyclic.add(normalizeClassName(returnTypeName, this.options.namespace));
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

    private isDescendantOf(className: string, ancestorName: string, classMap: Map<string, GirClass>): boolean {
        const cls = classMap.get(className);
        if (!cls) return false;
        if (cls.parent === ancestorName) return true;
        if (cls.parent && classMap.has(cls.parent)) {
            return this.isDescendantOf(cls.parent, ancestorName, classMap);
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
}
