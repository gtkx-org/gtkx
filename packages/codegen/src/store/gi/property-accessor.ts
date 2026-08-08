import { camelCase, sourceStringLiteral, toCamelIdentifier } from "@gtkx/utils";
import type { GirFunction } from "../../gir/function.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderDescriptor } from "../../analysis/descriptor-render.js";
import { inputParameters } from "../../analysis/param-structure.js";
import { renderTsType } from "../../analysis/ts-type.js";
import { type GirProperty, isConstructableProperty } from "../../gir/property.js";
import { renderBlock } from "../../writer/emit.js";
import { isEmittableCallable } from "./callables.js";
import { getDoc } from "./doc-spec.js";
import { methodExportName, renderMethodReturnType } from "./method.js";

type ResolvedAccessor = {
    property: GirProperty;
    jsName: string;
    tsType: string;
    hasGetter: boolean;
    isWritable: boolean;
    getterMember: string | undefined;
    getterMethod: GirFunction | undefined;
    setterMember: string | undefined;
};

type PropertyAccessorArgs = {
    context: ModuleContext;
    property: GirProperty;
    claimedNames: Set<string>;
    methodByName: Map<string, GirFunction>;
    inheritedType?: string | undefined;
};

type AccessorDelegate = { member: string | undefined; method: GirFunction | undefined };

type GetterBodyOptions = {
    context: ModuleContext;
    property: GirProperty;
    getterMember: string | undefined;
    getterMethod: GirFunction | undefined;
    tsType: string;
};

const isNullablePropertyType = (context: ModuleContext, type: TypeId | undefined): boolean => {
    if (type === undefined) {
        return false;
    }

    const resolved = context.library.typeFor(type);

    if (resolved === undefined) {
        return true;
    }

    if (resolved.kind === "primitive") {
        return false;
    }

    if (resolved.kind === "enum") {
        return false;
    }

    if (resolved.kind === "alias") {
        return isNullablePropertyType(context, resolved.value.target);
    }

    return true;
};

const resolveDelegate = (
    args: PropertyAccessorArgs,
    attribute: string | undefined,
    member: string | undefined,
    isDelegatable: (method: GirFunction) => boolean,
): AccessorDelegate => {
    const method = member !== undefined && attribute !== undefined ? args.methodByName.get(attribute) : undefined;
    const canDelegate = method === undefined || isDelegatable(method);

    return canDelegate ? { member, method } : { member: undefined, method: undefined };
};

const resolveGetterDelegate = (args: PropertyAccessorArgs, jsName: string): AccessorDelegate => {
    const { context, property, claimedNames } = args;
    const member = delegateMember(property.getter, jsName, claimedNames);

    return resolveDelegate(
        args,
        property.getter,
        member,
        (method) =>
            inputParameters(context.library, method).length === 0 &&
            !renderMethodReturnType(context, method).startsWith("["),
    );
};

const resolveSetterDelegate = (args: PropertyAccessorArgs, jsName: string, isWritable: boolean): AccessorDelegate => {
    const { context, property, claimedNames } = args;
    const member = isWritable ? delegateMember(property.setter, jsName, claimedNames) : undefined;

    return resolveDelegate(
        args,
        property.setter,
        member,
        (method) => inputParameters(context.library, method).length === 1,
    );
};

const resolveOwnType = (
    context: ModuleContext,
    property: GirProperty,
    getterMethod: GirFunction | undefined,
    setterMethod: GirFunction | undefined,
): string => {
    const setterParam = setterMethod?.parameters[0];

    if (setterParam !== undefined) {
        return renderTsType(context, setterParam.type, setterParam.nullable || setterParam.optional);
    }

    if (getterMethod !== undefined) {
        return renderMethodReturnType(context, getterMethod);
    }

    return renderTsType(context, property.type, isNullablePropertyType(context, property.type));
};

const isSkippedAccessor = (property: GirProperty, jsName: string, claimedNames: Set<string>): boolean =>
    !property.introspectable || claimedNames.has(jsName) || jsName === "constructor";

const resolveTsType = (inheritedType: string | undefined, ownType: string): string =>
    inheritedType !== undefined && inheritedType !== ownType ? inheritedType : ownType;

const resolveAccessor = (args: PropertyAccessorArgs): ResolvedAccessor | undefined => {
    const { context, property, claimedNames } = args;
    const jsName = toCamelIdentifier(property.name);

    if (isSkippedAccessor(property, jsName, claimedNames)) {
        return undefined;
    }

    const isWritable = isConstructableProperty(property) && !property.constructOnly;
    const { member: getterMember, method: getterMethod } = resolveGetterDelegate(args, jsName);
    const { member: setterMember, method: setterMethod } = resolveSetterDelegate(args, jsName, isWritable);
    const hasGetter = property.readable || getterMember !== undefined;

    if (!hasGetter && !isWritable) {
        return undefined;
    }

    const ownType = resolveOwnType(context, property, getterMethod, setterMethod);
    const tsType = resolveTsType(args.inheritedType, ownType);

    return { property, jsName, tsType, hasGetter, isWritable, getterMember, getterMethod, setterMember };
};

const resolveOwnerAccessor = (
    context: ModuleContext,
    property: GirProperty,
    methods: GirFunction[],
): ResolvedAccessor | undefined => {
    const methodByName: Map<string, GirFunction> = new Map();
    const claimedNames: Set<string> = new Set();

    for (const method of methods) {
        if (!isEmittableCallable(context, method)) {
            continue;
        }

        methodByName.set(method.name, method);
        claimedNames.add(methodExportName(method));
    }

    return resolveAccessor({ context, property, claimedNames, methodByName });
};

const resolveAccessorType = (
    context: ModuleContext,
    property: GirProperty,
    methods: GirFunction[],
): string | undefined => resolveOwnerAccessor(context, property, methods)?.tsType;

const withAccessor = (
    args: PropertyAccessorArgs,
    render: (accessor: ResolvedAccessor) => string,
): string | undefined => {
    const accessor = resolveAccessor(args);

    if (accessor === undefined) {
        return undefined;
    }

    return render(accessor);
};

const renderResolvedPropertyAccessor = (
    context: ModuleContext,
    property: GirProperty,
    accessor: ResolvedAccessor,
): string => {
    const { jsName, tsType, hasGetter, isWritable, getterMember, getterMethod, setterMember } = accessor;
    const blocks: string[] = [];

    if (hasGetter) {
        const getterBody = renderGetterBody({ context, property, getterMember, getterMethod, tsType });
        blocks.push(renderBlock(`get ${jsName}(): ${tsType}`, getterBody));
    }

    if (isWritable) {
        const setterBody =
            setterMember === undefined ? renderGenericSetBody(context, property) : `this.${setterMember}(value);`;

        blocks.push(renderBlock(`set ${jsName}(value: ${tsType})`, setterBody));
    }

    return `${propertyDoc(property)}${blocks.join("\n\n")}`;
};

const propertyDoc = (property: GirProperty): string =>
    getDoc(property);

const renderPropertyAccessor = (args: PropertyAccessorArgs): string | undefined =>
    withAccessor(args, (accessor) => renderResolvedPropertyAccessor(args.context, args.property, accessor));

const renderPropertyAccessorSignature = (args: PropertyAccessorArgs): string | undefined =>
    withAccessor(args, ({ jsName, tsType, hasGetter, isWritable }) => {
        const doc = propertyDoc(args.property);

        if (hasGetter && isWritable) {
            return `${doc}${jsName}: ${tsType};`;
        }

        if (hasGetter) {
            return `${doc}get ${jsName}(): ${tsType};`;
        }

        return `${doc}set ${jsName}(value: ${tsType});`;
    });

const renderPropertyDescriptor = (context: ModuleContext, property: GirProperty): string =>
    renderDescriptor(context, property.type, property.transferOwnership);

const renderGenericGetBody = (context: ModuleContext, property: GirProperty, tsType: string): string => {
    context.addRuntimeImport("getObjectProperty");
    context.addRuntimeImport("t");
    const descriptor = renderPropertyDescriptor(context, property);

    return `return getObjectProperty(this, ${sourceStringLiteral(property.name)}, ${descriptor}) as ${tsType};`;
};

const renderGenericSetBody = (context: ModuleContext, property: GirProperty): string => {
    context.addRuntimeImport("setObjectProperty");
    context.addRuntimeImport("t");
    const descriptor = renderPropertyDescriptor(context, property);

    return `setObjectProperty(this, ${sourceStringLiteral(property.name)}, ${descriptor}, value);`;
};

const renderGetterBody = (options: GetterBodyOptions): string => {
    const { context, property, getterMember, getterMethod, tsType } = options;

    if (getterMember === undefined) {
        return renderGenericGetBody(context, property, tsType);
    }

    if (getterMethod === undefined) {
        return `return this.${getterMember}() as ${tsType};`;
    }

    const getterType = renderMethodReturnType(context, getterMethod);

    return getterType === tsType ? `return this.${getterMember}();` : `return this.${getterMember}() as ${tsType};`;
};

const delegateMember = (
    attribute: string | undefined,
    accessorName: string,
    claimedNames: Set<string>,
): string | undefined => {
    if (attribute === undefined) {
        return undefined;
    }

    const member = camelCase(attribute);

    if (member === accessorName) {
        return undefined;
    }

    if (!claimedNames.has(member)) {
        return undefined;
    }

    return member;
};

export {
    propertyDoc,
    resolveAccessor,
    resolveOwnerAccessor,
    resolveAccessorType,
    renderResolvedPropertyAccessor,
    renderPropertyAccessor,
    renderPropertyAccessorSignature,
    type ResolvedAccessor,
    type PropertyAccessorArgs,
};
