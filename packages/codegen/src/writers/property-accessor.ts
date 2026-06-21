import { quote, toCamelCase, toCamelIdentifier } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { renderBlock } from "../dsl/emit.js";
import type { GirFunction } from "../gir/function.js";
import { type GirProperty, isConstructableProperty } from "../gir/property.js";
import type { TypeId } from "../gir/type-id.js";
import { renderMethodReturnType } from "./method.js";
import { renderTsType } from "./ts-type.js";
import { renderFfiType } from "./value.js";

const isNullablePropertyType = (context: ModuleContext, type: TypeId | undefined): boolean => {
    if (type === undefined) return false;
    const resolved = context.repository.typeOf(type);
    if (resolved === undefined) return true;
    if (resolved.kind === "primitive") return false;
    if (resolved.kind === "enum") return false;
    if (resolved.kind === "alias") return isNullablePropertyType(context, resolved.target);
    return true;
};

type ResolvedAccessor = {
    jsName: string;
    tsType: string;
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
};

const resolveAccessor = (args: PropertyAccessorArgs): ResolvedAccessor | undefined => {
    const { context, property, claimedNames, methodByName } = args;
    const jsName = toCamelIdentifier(property.name);
    if (claimedNames.has(jsName)) return undefined;
    if (jsName === "constructor") return undefined;

    const writable = isConstructableProperty(property);
    const getterMember = delegateMember(property.getter, jsName, claimedNames);
    const getMethod =
        getterMember !== undefined && property.getter !== undefined ? methodByName.get(property.getter) : undefined;
    const setterMember = writable ? delegateMember(property.setter, jsName, claimedNames) : undefined;
    const setMethod =
        setterMember !== undefined && property.setter !== undefined ? methodByName.get(property.setter) : undefined;
    const setParam = setMethod?.parameters[0];

    const tsType =
        setParam !== undefined
            ? renderTsType(context, setParam.type, setParam.nullable || setParam.optional)
            : getMethod !== undefined
              ? renderMethodReturnType(context, getMethod)
              : renderTsType(context, property.type, isNullablePropertyType(context, property.type));

    return { jsName, tsType, writable, getterMember, getMethod, setterMember };
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
        const { jsName, tsType, writable, getterMember, getMethod, setterMember } = accessor;

        const blocks: string[] = [];
        const getBody = renderGetterBody({ context, property, getterMember, getMethod, tsType });
        blocks.push(renderBlock(`get ${jsName}(): ${tsType}`, getBody));

        if (writable) {
            const setBody =
                setterMember !== undefined ? `this.${setterMember}(value);` : renderGenericSetBody(context, property);
            blocks.push(renderBlock(`set ${jsName}(value: ${tsType})`, setBody));
        }
        return blocks.join("\n\n");
    });

export const renderPropertyAccessorSignature = (args: PropertyAccessorArgs): string | undefined =>
    withAccessor(args, ({ jsName, tsType, writable }) =>
        writable ? `${jsName}: ${tsType};` : `get ${jsName}(): ${tsType};`,
    );

const renderPropertyFfiType = (context: ModuleContext, property: GirProperty): string =>
    renderFfiType(context, property.type, property.transferOwnership);

const renderGenericGetBody = (context: ModuleContext, property: GirProperty, tsType: string): string => {
    context.addRuntimeImport("getGobjectProperty");
    context.addRuntimeImport("t");
    return `return getGobjectProperty(this, ${quote(property.name)}, ${renderPropertyFfiType(context, property)}) as ${tsType};`;
};

const renderGenericSetBody = (context: ModuleContext, property: GirProperty): string => {
    context.addRuntimeImport("setGobjectProperty");
    context.addRuntimeImport("t");
    return `setGobjectProperty(this, ${quote(property.name)}, ${renderPropertyFfiType(context, property)}, value);`;
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
