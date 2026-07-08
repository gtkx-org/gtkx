import { sourceStringLiteral, toCamelCase, toCamelIdentifier } from "@gtkx/utils";
import { renderDescriptor } from "../../analysis/descriptor-render.js";
import { inputParameters } from "../../analysis/param-structure.js";
import { renderTsType } from "../../analysis/ts-type.js";
import type { GirFunction } from "../../gir/function.js";
import { type GirProperty, isConstructableProperty } from "../../gir/property.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderJsDoc } from "../../writer/doc.js";
import { renderBlock } from "../../writer/emit.js";
import { renderMethodReturnType } from "./method.js";

const isNullablePropertyType = (context: ModuleContext, type: TypeId | undefined): boolean => {
    if (type === undefined) return false;
    const resolved = context.library.typeOf(type);
    if (resolved === undefined) return true;
    if (resolved.kind === "primitive") return false;
    if (resolved.kind === "enum") return false;
    if (resolved.kind === "alias") return isNullablePropertyType(context, resolved.value.target);
    return true;
};

type ResolvedAccessor = {
    jsName: string;
    tsType: string;
    hasGetter: boolean;
    writable: boolean;
    getterMember: string | undefined;
    getMethod: GirFunction | undefined;
    setterMember: string | undefined;
};

export type PropertyAccessorArgs = {
    context: ModuleContext;
    property: GirProperty;
    claimedNames: Set<string>;
    methodByName: Map<string, GirFunction>;
    inheritedType?: string | undefined;
};

type AccessorDelegate = { member: string | undefined; method: GirFunction | undefined };

const resolveGetterDelegate = (args: PropertyAccessorArgs, jsName: string): AccessorDelegate => {
    const { context, property, claimedNames, methodByName } = args;
    const member = delegateMember(property.getter, jsName, claimedNames);
    const method =
        member !== undefined && property.getter !== undefined ? methodByName.get(property.getter) : undefined;
    const delegatable =
        method === undefined ||
        (inputParameters(context.library, method).length === 0 &&
            !renderMethodReturnType(context, method).startsWith("["));
    return delegatable ? { member, method } : { member: undefined, method: undefined };
};

const resolveSetterDelegate = (args: PropertyAccessorArgs, jsName: string, writable: boolean): AccessorDelegate => {
    const { context, property, claimedNames, methodByName } = args;
    const member = writable ? delegateMember(property.setter, jsName, claimedNames) : undefined;
    const method =
        member !== undefined && property.setter !== undefined ? methodByName.get(property.setter) : undefined;
    const delegatable = method === undefined || inputParameters(context.library, method).length === 1;
    return delegatable ? { member, method } : { member: undefined, method: undefined };
};

const resolveAccessor = (args: PropertyAccessorArgs): ResolvedAccessor | undefined => {
    const { context, property, claimedNames } = args;
    const jsName = toCamelIdentifier(property.name);
    if (claimedNames.has(jsName)) return undefined;
    if (jsName === "constructor") return undefined;

    const writable = isConstructableProperty(property);
    const { member: getterMember, method: getMethod } = resolveGetterDelegate(args, jsName);
    const { member: setterMember, method: setMethod } = resolveSetterDelegate(args, jsName, writable);
    const setParam = setMethod?.parameters[0];

    const hasGetter = property.readable || getterMember !== undefined;
    if (!hasGetter && !writable) return undefined;

    const ownType =
        setParam !== undefined
            ? renderTsType(context, setParam.type, setParam.nullable || setParam.optional)
            : getMethod !== undefined
              ? renderMethodReturnType(context, getMethod)
              : renderTsType(context, property.type, isNullablePropertyType(context, property.type));

    const tsType = args.inheritedType !== undefined && args.inheritedType !== ownType ? args.inheritedType : ownType;

    return { jsName, tsType, hasGetter, writable, getterMember, getMethod, setterMember };
};

export const resolveAccessorType = (
    context: ModuleContext,
    property: GirProperty,
    methods: GirFunction[],
): string | undefined => {
    const methodByName = new Map<string, GirFunction>();
    const claimedNames = new Set<string>();
    for (const method of methods) {
        methodByName.set(method.name, method);
        claimedNames.add(toCamelCase(method.name));
    }
    return resolveAccessor({ context, property, claimedNames, methodByName })?.tsType;
};

const withAccessor = (
    args: PropertyAccessorArgs,
    render: (accessor: ResolvedAccessor) => string,
): string | undefined => {
    const accessor = resolveAccessor(args);
    if (accessor === undefined) return undefined;
    return render(accessor);
};

export const renderPropertyAccessor = (args: PropertyAccessorArgs): string | undefined =>
    withAccessor(args, (accessor) => {
        const { context, property } = args;
        const { jsName, tsType, hasGetter, writable, getterMember, getMethod, setterMember } = accessor;

        const blocks: string[] = [];
        if (hasGetter) {
            const getBody = renderGetterBody({ context, property, getterMember, getMethod, tsType });
            blocks.push(renderBlock(`get ${jsName}(): ${tsType}`, getBody));
        }

        if (writable) {
            const setBody =
                setterMember !== undefined ? `this.${setterMember}(value);` : renderGenericSetBody(context, property);
            blocks.push(renderBlock(`set ${jsName}(value: ${tsType})`, setBody));
        }
        return `${renderJsDoc(property.doc)}${blocks.join("\n\n")}`;
    });

export const renderPropertyAccessorSignature = (args: PropertyAccessorArgs): string | undefined =>
    withAccessor(args, ({ jsName, tsType, hasGetter, writable }) => {
        const doc = renderJsDoc(args.property.doc);
        if (hasGetter && writable) return `${doc}${jsName}: ${tsType};`;
        if (hasGetter) return `${doc}get ${jsName}(): ${tsType};`;
        return `${doc}set ${jsName}(value: ${tsType});`;
    });

const renderPropertyDescriptor = (context: ModuleContext, property: GirProperty): string =>
    renderDescriptor(context, property.type, property.transferOwnership);

const renderGenericGetBody = (context: ModuleContext, property: GirProperty, tsType: string): string => {
    context.addRuntimeImport("getObjectProperty");
    context.addRuntimeImport("t");
    return `return getObjectProperty(this, ${sourceStringLiteral(property.name)}, ${renderPropertyDescriptor(context, property)}) as ${tsType};`;
};

const renderGenericSetBody = (context: ModuleContext, property: GirProperty): string => {
    context.addRuntimeImport("setObjectProperty");
    context.addRuntimeImport("t");
    return `setObjectProperty(this, ${sourceStringLiteral(property.name)}, ${renderPropertyDescriptor(context, property)}, value);`;
};

type GetterBodyOptions = {
    context: ModuleContext;
    property: GirProperty;
    getterMember: string | undefined;
    getMethod: GirFunction | undefined;
    tsType: string;
};

const renderGetterBody = (options: GetterBodyOptions): string => {
    const { context, property, getterMember, getMethod, tsType } = options;
    if (getterMember === undefined) return renderGenericGetBody(context, property, tsType);
    if (getMethod === undefined) return `return this.${getterMember}() as ${tsType};`;
    const getType = renderMethodReturnType(context, getMethod);
    return getType === tsType ? `return this.${getterMember}();` : `return this.${getterMember}() as ${tsType};`;
};

const delegateMember = (
    attribute: string | undefined,
    accessorName: string,
    claimedNames: Set<string>,
): string | undefined => {
    if (attribute === undefined) return undefined;
    const member = toCamelCase(attribute);
    if (member === accessorName) return undefined;
    if (!claimedNames.has(member)) return undefined;
    return member;
};
