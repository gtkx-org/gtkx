import { camelCase, sourceStringLiteral, toCamelIdentifier } from "@gtkx/utils";
import type { GirFunction } from "../../gir/function.js";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderDescriptor } from "../../analysis/descriptor-render.js";
import { inputParameters } from "../../analysis/param-structure.js";
import { renderTsType } from "../../analysis/ts-type.js";
import { type GirProperty, isConstructableProperty } from "../../gir/property.js";
import { comparisonContextFor } from "../../writer/comparison-context.js";
import { renderBlock } from "../../writer/emit.js";
import { isEmittableCallable } from "./callables.js";
import { getDoc } from "./doc-spec.js";
import { methodExportName, renderMethodReturnType } from "./method.js";

type AccessorTypes = {
    readType: string;
    writeType: string;
};

type InheritedAccessorTypes = {
    readType: string | undefined;
    writeType: string | undefined;
};

type ResolvedAccessor = {
    property: GirProperty;
    jsName: string;
    readType: string;
    writeType: string;
    hasGetter: boolean;
    isWritable: boolean;
    getterMember: string | undefined;
    setterMember: string | undefined;
};

type PropertyAccessorArgs = {
    context: ModuleContext;
    property: GirProperty;
    claimedNames: Set<string>;
    methodByName: Map<string, GirFunction>;
    inheritedTypes?: InheritedAccessorTypes | undefined;
    inheritedNames?: Set<string> | undefined;
};

type AccessorDelegate = { member: string; method: GirFunction };
type AccessorDelegates = { getter: AccessorDelegate | undefined; setter: AccessorDelegate | undefined };
type TypedDelegates = { types: AccessorTypes; delegates: AccessorDelegates };

const NULLABLE_SUFFIX = " | null";

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
): AccessorDelegate | undefined => {
    const method = member !== undefined && attribute !== undefined ? args.methodByName.get(attribute) : undefined;

    if (member === undefined || method === undefined || !isDelegatable(method)) {
        return undefined;
    }

    return { member, method };
};

const resolveGetterDelegate = (args: PropertyAccessorArgs, jsName: string): AccessorDelegate | undefined => {
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

const resolveSetterDelegate = (
    args: PropertyAccessorArgs,
    jsName: string,
    isWritable: boolean,
): AccessorDelegate | undefined => {
    const { context, property, claimedNames } = args;
    const member = isWritable ? delegateMember(property.setter, jsName, claimedNames) : undefined;

    return resolveDelegate(
        args,
        property.setter,
        member,
        (method) => inputParameters(context.library, method).length === 1,
    );
};

const baseTypeName = (type: string): string =>
    type.endsWith(NULLABLE_SUFFIX) ? type.slice(0, -NULLABLE_SUFFIX.length) : type;

const areDelegateBaseTypesAgreeing = (
    context: ModuleContext,
    getter: AccessorDelegate | undefined,
    setter: AccessorDelegate | undefined,
): boolean => {
    const setterParam = setter?.method.parameters[0];

    if (setterParam === undefined || getter === undefined) {
        return true;
    }

    const scratch = comparisonContextFor(context);
    const read = baseTypeName(renderMethodReturnType(scratch, getter.method));
    const written = baseTypeName(renderTsType(scratch, setterParam.type, false));

    return read === written;
};

const resolveDelegates = (args: PropertyAccessorArgs, jsName: string, isWritable: boolean): AccessorDelegates => {
    const getter = resolveGetterDelegate(args, jsName);
    const setter = resolveSetterDelegate(args, jsName, isWritable);

    if (areDelegateBaseTypesAgreeing(args.context, getter, setter)) {
        return { getter, setter };
    }

    return { getter, setter: undefined };
};

const declaredPropertyType = (context: ModuleContext, property: GirProperty): string =>
    renderTsType(context, property.type, isNullablePropertyType(context, property.type));

const resolveOwnTypes = (
    context: ModuleContext,
    property: GirProperty,
    delegates: AccessorDelegates,
): AccessorTypes => {
    const getterMethod = delegates.getter?.method;
    const setterParam = delegates.setter?.method.parameters[0];

    return {
        readType: getterMethod === undefined
            ? declaredPropertyType(context, property)
            : renderMethodReturnType(context, getterMethod),
        writeType: setterParam === undefined
            ? declaredPropertyType(context, property)
            : renderTsType(context, setterParam.type, setterParam.nullable || setterParam.optional),
    };
};

const isAssignableType = (source: string, target: string): boolean =>
    source === target || baseTypeName(target) === source;

const agreeingDelegates = (
    delegates: AccessorDelegates,
    ownTypes: AccessorTypes,
    declaredTypes: AccessorTypes,
): AccessorDelegates => ({
    getter: isAssignableType(ownTypes.readType, declaredTypes.readType) ? delegates.getter : undefined,
    setter: isAssignableType(declaredTypes.writeType, ownTypes.writeType) ? delegates.setter : undefined,
});

const resolveTypedDelegates = (args: PropertyAccessorArgs, resolved: AccessorDelegates): TypedDelegates => {
    const ownTypes = resolveOwnTypes(args.context, args.property, resolved);

    const types = {
        readType: args.inheritedTypes?.readType ?? ownTypes.readType,
        writeType: args.inheritedTypes?.writeType ?? ownTypes.writeType,
    };

    return { types, delegates: agreeingDelegates(resolved, ownTypes, types) };
};

const isSkippedAccessor = (args: PropertyAccessorArgs, jsName: string): boolean =>
    !args.property.introspectable ||
    args.claimedNames.has(jsName) ||
    args.inheritedNames?.has(jsName) === true ||
    jsName === "constructor";

const resolveAccessor = (args: PropertyAccessorArgs): ResolvedAccessor | undefined => {
    const { property } = args;
    const jsName = toCamelIdentifier(property.name);

    if (isSkippedAccessor(args, jsName)) {
        return undefined;
    }

    const isWritable = isConstructableProperty(property) && !property.constructOnly;
    const { types, delegates } = resolveTypedDelegates(args, resolveDelegates(args, jsName, isWritable));
    const hasGetter = property.readable || delegates.getter !== undefined;

    if (!hasGetter && !isWritable) {
        return undefined;
    }

    return {
        property,
        jsName,
        readType: types.readType,
        writeType: types.writeType,
        hasGetter,
        isWritable,
        getterMember: delegates.getter?.member,
        setterMember: delegates.setter?.member,
    };
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

const resolveAccessorTypes = (
    context: ModuleContext,
    property: GirProperty,
    methods: GirFunction[],
): InheritedAccessorTypes | undefined => {
    const accessor = resolveOwnerAccessor(context, property, methods);

    if (accessor === undefined) {
        return undefined;
    }

    return {
        readType: accessor.hasGetter ? accessor.readType : undefined,
        writeType: accessor.isWritable ? accessor.writeType : undefined,
    };
};

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
    const { jsName, readType, writeType, hasGetter, isWritable, setterMember } = accessor;
    const blocks: string[] = [];

    if (hasGetter) {
        blocks.push(renderBlock(`get ${jsName}(): ${readType}`, renderGetterBody(context, property, accessor)));
    }

    if (isWritable) {
        const setterBody =
            setterMember === undefined ? renderGenericSetBody(context, property) : `this.${setterMember}(value);`;

        blocks.push(renderBlock(`set ${jsName}(value: ${writeType})`, setterBody));
    }

    return `${propertyDoc(property)}${blocks.join("\n\n")}`;
};

const propertyDoc = (property: GirProperty): string =>
    getDoc(property);

const renderPropertyAccessor = (args: PropertyAccessorArgs): string | undefined =>
    withAccessor(args, (accessor) => renderResolvedPropertyAccessor(args.context, args.property, accessor));

const renderAccessorPairSignature = (accessor: ResolvedAccessor): string => {
    const { jsName, readType, writeType, hasGetter, isWritable } = accessor;

    if (!hasGetter) {
        return `set ${jsName}(value: ${writeType});`;
    }

    if (!isWritable) {
        return `get ${jsName}(): ${readType};`;
    }

    if (readType === writeType) {
        return `${jsName}: ${readType};`;
    }

    return `get ${jsName}(): ${readType};\nset ${jsName}(value: ${writeType});`;
};

const renderPropertyAccessorSignature = (args: PropertyAccessorArgs): string | undefined =>
    withAccessor(args, (accessor) => `${propertyDoc(args.property)}${renderAccessorPairSignature(accessor)}`);

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

const renderGetterBody = (context: ModuleContext, property: GirProperty, accessor: ResolvedAccessor): string =>
    accessor.getterMember === undefined
        ? renderGenericGetBody(context, property, accessor.readType)
        : `return this.${accessor.getterMember}();`;

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
    resolveAccessorTypes,
    renderResolvedPropertyAccessor,
    renderPropertyAccessor,
    renderPropertyAccessorSignature,
    type InheritedAccessorTypes,
    type ResolvedAccessor,
    type PropertyAccessorArgs,
};
