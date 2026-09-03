import { sourceStringLiteral, toCamelIdentifier } from "@gtkx/utils";
import type { TypeId } from "../../gir/type-id.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderDescriptor } from "../../analysis/descriptor-render.js";
import { renderTsType } from "../../analysis/ts-type.js";
import { isUnboundedArray, primitiveCategoryFor } from "../../analysis/type-shape.js";
import { type GirProperty, isConstructableProperty } from "../../gir/property.js";
import { renderBlock } from "../../writer/emit.js";
import { getDoc } from "./doc-spec.js";
import { underlyingType } from "./param-marshal.js";

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
    supportsDescriptorFreeAccess: boolean;
};

type PropertyAccessorArgs = {
    context: ModuleContext;
    property: GirProperty;
    claimedNames: Set<string>;
    inheritedTypes?: InheritedAccessorTypes | undefined;
    inheritedNames?: Set<string> | undefined;
};

const NON_NULLABLE_KINDS: Set<string> = new Set(["primitive", "enum"]);

const isNullablePropertyType = (context: ModuleContext, type: TypeId | undefined): boolean => {
    if (type === undefined) {
        return false;
    }

    const resolved = context.library.typeFor(type);

    if (resolved === undefined) {
        return true;
    }

    if (resolved.kind === "alias") {
        return isNullablePropertyType(context, resolved.value.target);
    }

    return !NON_NULLABLE_KINDS.has(resolved.kind);
};

const declaredPropertyType = (context: ModuleContext, property: GirProperty): string =>
    renderTsType(
        context,
        property.type,
        property.defaultValue === "NULL" || isNullablePropertyType(context, property.type),
    );

const canAccessPropertyWithoutDescriptor = (context: ModuleContext, ref: TypeId | undefined): boolean => {
    if (ref === undefined) {
        return false;
    }

    const type = underlyingType(context, ref);

    if (type === undefined) {
        return false;
    }

    switch (type.kind) {
        case "primitive": {
            return type.category !== "pointer" && type.category !== "unichar" && type.category !== "void";
        }
        case "enum": {
            return true;
        }
        case "class":
        case "interface":
        case "record": {
            return type.value.glibGetType !== undefined;
        }
        case "carray": {
            return isUnboundedArray(type) && primitiveCategoryFor(context.library, type.element) === "string";
        }
        case "list": {
            return type.flavor === "gbytearray";
        }
        case "alias":
        case "callback":
        case "hashtable":
        case "varargs": {
            return false;
        }
    }
};

const isSkippedAccessor = (args: PropertyAccessorArgs, jsName: string): boolean =>
    !args.property.introspectable ||
    args.claimedNames.has(jsName) ||
    args.inheritedNames?.has(jsName) === true ||
    jsName === "constructor";

const isAccessorEmittable = (args: PropertyAccessorArgs, jsName: string, isWritable: boolean): boolean =>
    !isSkippedAccessor(args, jsName) && (args.property.readable || isWritable);

const resolvePropertyMetadata = (
    context: ModuleContext,
    property: GirProperty,
    inheritedTypes?: InheritedAccessorTypes,
): ResolvedAccessor | undefined => {
    const jsName = toCamelIdentifier(property.name);
    const isWritable = isConstructableProperty(property) && !property.constructOnly;

    if (!property.introspectable || (!isWritable && !property.readable)) {
        return undefined;
    }

    const declared = declaredPropertyType(context, property);
    const hasGetter = property.readable;

    return {
        property,
        jsName,
        readType: inheritedTypes?.readType ?? declared,
        writeType: inheritedTypes?.writeType ?? declared,
        hasGetter,
        isWritable,
        supportsDescriptorFreeAccess: canAccessPropertyWithoutDescriptor(context, property.type),
    };
};

const resolveAccessor = (args: PropertyAccessorArgs): ResolvedAccessor | undefined => {
    const accessor = resolvePropertyMetadata(args.context, args.property, args.inheritedTypes);

    if (accessor === undefined || !isAccessorEmittable(args, accessor.jsName, accessor.isWritable)) {
        return undefined;
    }

    return accessor;
};

const resolveAccessorTypes = (
    context: ModuleContext,
    property: GirProperty,
): InheritedAccessorTypes | undefined => {
    const accessor = resolvePropertyMetadata(context, property);

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
    const { jsName, readType, writeType, hasGetter, isWritable } = accessor;
    const blocks: string[] = [];

    if (hasGetter) {
        blocks.push(renderBlock(`get ${jsName}(): ${readType}`, renderGenericGetBody(context, property, readType)));
    }

    if (isWritable) {
        blocks.push(renderBlock(`set ${jsName}(value: ${writeType})`, renderGenericSetBody(context, property)));
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
    renderDescriptor(context, property.type, property.transferOwnership, { isReceived: true });

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

export {
    propertyDoc,
    resolveAccessor,
    resolvePropertyMetadata,
    resolveAccessorTypes,
    renderResolvedPropertyAccessor,
    renderPropertyAccessor,
    renderPropertyAccessorSignature,
    type InheritedAccessorTypes,
    type ResolvedAccessor,
    type PropertyAccessorArgs,
};
