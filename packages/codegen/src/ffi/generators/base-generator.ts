import type { FfiTypeDescriptor, GirParameter, TypeMapper, TypeRegistry } from "@gtkx/gir";
import {
    formatDoc as formatDocBase,
    formatMethodDoc as formatMethodDocBase,
    sanitizeDoc as sanitizeDocBase,
    toCamelCase,
    toValidIdentifier,
} from "@gtkx/gir";
import type { GenerationContext } from "../generation-context.js";
import { generateCallbackWrapperCode } from "../utils/callback-wrapper.js";

export type GeneratorOptions = {
    namespace: string;
    prettierConfig?: unknown;
    typeRegistry?: TypeRegistry;
    allNamespaces?: Map<string, unknown>;
    sharedLibrary?: string;
};

export abstract class BaseGenerator {
    protected readonly typeMapper: TypeMapper;
    protected readonly ctx: GenerationContext;
    protected readonly options: GeneratorOptions;

    constructor(typeMapper: TypeMapper, ctx: GenerationContext, options: GeneratorOptions) {
        this.typeMapper = typeMapper;
        this.ctx = ctx;
        this.options = options;
    }

    protected get currentSharedLibrary(): string {
        return this.ctx.currentSharedLibrary;
    }

    protected sanitizeDoc(doc: string): string {
        return sanitizeDocBase(doc, { namespace: this.options.namespace });
    }

    protected formatDoc(doc: string | undefined, indent: string = ""): string {
        return formatDocBase(doc, indent, { namespace: this.options.namespace });
    }

    protected formatMethodDoc(doc: string | undefined, params: GirParameter[], indent: string = "  "): string {
        const formattedParams = params
            .filter((p) => p.doc && p.name && p.name !== "..." && p.name !== "")
            .map((p) => ({
                name: toValidIdentifier(toCamelCase(p.name)),
                doc: p.doc,
            }));
        return formatMethodDocBase(doc, formattedParams, indent, { namespace: this.options.namespace });
    }

    protected isVararg(param: GirParameter): boolean {
        return param.name === "..." || param.name === "";
    }

    protected generateParameterList(parameters: GirParameter[], makeAllOptional = false): string {
        const filteredParams = parameters.filter(
            (p, i) => !this.isVararg(p) && !this.typeMapper.isClosureTarget(i, parameters),
        );

        const required: string[] = [];
        const optional: string[] = [];

        for (const param of filteredParams) {
            const mapped = this.typeMapper.mapParameter(param);
            const paramName = toValidIdentifier(toCamelCase(param.name));
            const isOptional = makeAllOptional || this.typeMapper.isNullable(param);
            const typeStr = mapped.ts;
            const paramStr = `${paramName}${isOptional ? "?" : ""}: ${typeStr}`;
            (isOptional ? optional : required).push(paramStr);
        }

        return [...required, ...optional].join(", ");
    }

    protected generateCallArguments(
        parameters: GirParameter[],
        indent = "      ",
        paramMappings?: Map<string, string>,
    ): string {
        return parameters
            .filter((p, i) => !this.isVararg(p) && !this.typeMapper.isClosureTarget(i, parameters))
            .map((param) => {
                const mapped = this.typeMapper.mapParameter(param);
                const jsParamName = toValidIdentifier(toCamelCase(param.name));
                const needsPtr = mapped.ffi.type === "gobject" || mapped.ffi.type === "boxed";
                const effectiveName = paramMappings?.get(jsParamName) ?? jsParamName;
                const valueName = needsPtr ? `(${effectiveName} as any)?.id ?? ${effectiveName}` : effectiveName;
                const isOptional = this.typeMapper.isNullable(param);
                const optionalPart = isOptional ? `,\n${indent}    optional: true` : "";
                return `${indent}  {\n${indent}    type: ${this.generateTypeDescriptor(mapped.ffi)},\n${indent}    value: ${valueName}${optionalPart},\n${indent}  }`;
            })
            .join(",\n");
    }

    /**
     * Generates wrapper code for callbacks that have gobject argTypes.
     * Returns the wrapper declarations and a mapping from original param names to wrapper names.
     */
    protected generateCallbackWrappers(
        parameters: GirParameter[],
        indent = "      ",
    ): { wrapperCode: string; paramMappings: Map<string, string> } {
        const wrapperCode: string[] = [];
        const paramMappings = new Map<string, string>();

        for (const param of parameters) {
            const mapped = this.typeMapper.mapParameter(param);
            if (mapped.ffi.type !== "callback") continue;

            const jsParamName = toValidIdentifier(toCamelCase(param.name));
            const wrappedName = `_wrapped_${jsParamName}`;

            const result = generateCallbackWrapperCode({
                callbackName: jsParamName,
                wrappedName,
                argTypes: mapped.ffi.argTypes,
                returnType: mapped.ffi.returnType,
                hasSelfArg: false,
                indent,
            });

            if (!result.code) continue;

            paramMappings.set(jsParamName, wrappedName);
            wrapperCode.push(result.code);

            if (result.usesGetNativeObject) this.ctx.usesGetNativeObject = true;
            if (result.usesGetNativeClass) this.ctx.usesGetClassByTypeName = true;
        }

        return { wrapperCode: wrapperCode.join("\n"), paramMappings };
    }

    protected generateTypeDescriptor(type: FfiTypeDescriptor): string {
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
            if (innerType === "GVariant") {
                const parts = [`type: "gvariant"`];
                if (type.borrowed) {
                    parts.push(`borrowed: true`);
                }
                return `{ ${parts.join(", ")} }`;
            }
            const lib = type.lib ?? this.currentSharedLibrary;
            const parts = [`type: "boxed"`, `innerType: "${innerType}"`, `lib: "${lib}"`];
            if (type.borrowed) {
                parts.splice(1, 0, `borrowed: true`);
            }
            if (type.getTypeFn) {
                parts.push(`getTypeFn: "${type.getTypeFn}"`);
            }
            return `{ ${parts.join(", ")} }`;
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

    protected generateErrorArgument(indent = "      "): string {
        return `${indent}  {\n${indent}    type: { type: "ref", innerType: { type: "boxed", innerType: "GError", lib: "libglib-2.0.so.0" } },\n${indent}    value: error,\n${indent}  }`;
    }

    protected generateErrorCheck(indent = "  "): string {
        this.ctx.usesNativeError = true;
        return `${indent}  if (error.value !== null) {
${indent}    throw new NativeError(error.value);
${indent}  }`;
    }

    protected identifyGtkAllocatesRefs(parameters: GirParameter[]): {
        paramName: string;
        innerType: string;
        nullable: boolean;
        isBoxed: boolean;
        boxedTypeName: string | undefined;
    }[] {
        return parameters
            .filter((p, i) => !this.isVararg(p) && !this.typeMapper.isClosureTarget(i, parameters))
            .map((param) => {
                const mapped = this.typeMapper.mapParameter(param);
                if (
                    mapped.ffi.type === "ref" &&
                    typeof mapped.ffi.innerType === "object" &&
                    (mapped.ffi.innerType.type === "boxed" || mapped.ffi.innerType.type === "gobject")
                ) {
                    const innerTsType = mapped.ts.slice(4, -1);
                    const isBoxed = mapped.ffi.innerType.type === "boxed";
                    const boxedTypeName = isBoxed
                        ? (mapped.ffi.innerType as { innerType?: string }).innerType
                        : undefined;
                    return {
                        paramName: toValidIdentifier(toCamelCase(param.name)),
                        innerType: innerTsType,
                        nullable: this.typeMapper.isNullable(param),
                        isBoxed,
                        boxedTypeName,
                    };
                }
                return null;
            })
            .filter((x): x is NonNullable<typeof x> => x !== null);
    }

    protected generateRefRewrapCode(
        gtkAllocatesRefs: {
            paramName: string;
            innerType: string;
            nullable: boolean;
            isBoxed: boolean;
            boxedTypeName: string | undefined;
        }[],
    ): string[] {
        if (gtkAllocatesRefs.length === 0) {
            return [];
        }

        return gtkAllocatesRefs.map((ref) => {
            if (ref.isBoxed) {
                this.ctx.usesGetNativeObject = true;
                return ref.nullable
                    ? `    if (${ref.paramName}) ${ref.paramName}.value = getNativeObject(${ref.paramName}.value, ${ref.innerType})!;`
                    : `    ${ref.paramName}.value = getNativeObject(${ref.paramName}.value, ${ref.innerType})!;`;
            }
            this.ctx.usesGetNativeObject = true;
            return ref.nullable
                ? `    if (${ref.paramName}) ${ref.paramName}.value = getNativeObject(${ref.paramName}.value)! as ${ref.innerType};`
                : `    ${ref.paramName}.value = getNativeObject(${ref.paramName}.value)! as ${ref.innerType};`;
        });
    }

    protected hasRefParameter(params: GirParameter[]): boolean {
        const savedSameNamespace = this.typeMapper.getSameNamespaceClassUsageCallback();
        const savedExternal = this.typeMapper.getExternalTypeUsageCallback();
        const savedRecord = this.typeMapper.getRecordUsageCallback();
        const savedEnum = this.typeMapper.getEnumUsageCallback();

        this.typeMapper.setSameNamespaceClassUsageCallback(null);
        this.typeMapper.setExternalTypeUsageCallback(null);
        this.typeMapper.setRecordUsageCallback(null);
        this.typeMapper.setEnumUsageCallback(null);

        const result = params.some((p) => this.typeMapper.mapParameter(p).ts.startsWith("Ref<"));

        this.typeMapper.setSameNamespaceClassUsageCallback(savedSameNamespace);
        this.typeMapper.setExternalTypeUsageCallback(savedExternal);
        this.typeMapper.setRecordUsageCallback(savedRecord);
        this.typeMapper.setEnumUsageCallback(savedEnum);

        return result;
    }

    protected hasUnsupportedCallbacks(params: GirParameter[]): boolean {
        return params.some((p) => this.typeMapper.hasUnsupportedCallback(p));
    }
}
