import { quote, toCamelCase, toIdentifier } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";
import type { GirFunction } from "../gir/function.js";
import type { GirProperty } from "../gir/property.js";
import type { GirTypeRef } from "../gir/type-ref.js";
import { renderMethodReturnType } from "./method.js";
import { renderTsType } from "./ts-type.js";

/**
 * Whether a GObject property of `type` can hold `null`.
 *
 * Reference values — objects, boxed records, interfaces, and containers —
 * marshal to `null` when unset; scalar value types (numbers, booleans,
 * strings, `unichar`, enums) are surfaced non-null to match their typed
 * setters. Aliases resolve to their target.
 *
 * @param context - The module context
 * @param type - The property's value type
 */
const isNullablePropertyType = (context: ModuleContext, type: GirTypeRef | undefined): boolean => {
    if (type === undefined) return false;
    if (type.kind === "primitive") return false;
    if (type.kind !== "named") return true;
    const resolved = context.repository.resolveNamed(type.namespaceName ?? context.namespace.name, type.typeName);
    if (resolved === undefined) return true;
    if (resolved.kind === "enum") return false;
    if (resolved.kind === "alias") return isNullablePropertyType(context, resolved.targetRef);
    return true;
};

/**
 * Renders the `get` / `set` accessor pair for a single GObject property
 * on a class declaration.
 *
 * Read-only properties get only a getter; readonly + non-writable
 * properties are skipped entirely. Properties whose name has already
 * been claimed by an emitted method (its camelCase form clashes) are
 * skipped, since the method takes precedence — the runtime accessor is
 * always reachable via `this.getProperty(girName)` in that case.
 *
 * @param context - The module context
 * @param property - The property to surface
 * @param claimedNames - Names already used by emitted methods
 */
export const renderPropertyAccessor = (
    context: ModuleContext,
    property: GirProperty,
    claimedNames: ReadonlySet<string>,
    methodByName: ReadonlyMap<string, GirFunction>,
): string | undefined => {
    const jsName = toIdentifier(toCamelCase(property.name));
    if (claimedNames.has(jsName)) return undefined;
    if (jsName === "constructor") return undefined;

    const writable = property.writable || property.construct || property.constructOnly;
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

    const blocks: string[] = [];
    const getBody = renderGetterBody({ context, property, getterMember, getMethod, tsType });
    blocks.push(`get ${jsName}(): ${tsType} {\n${indent(getBody, 1)}\n}`);

    if (writable) {
        const setBody =
            setterMember !== undefined
                ? `this.${setterMember}(value);`
                : `this.setProperty(${quote(property.name)}, value);`;
        blocks.push(`set ${jsName}(value: ${tsType}) {\n${indent(setBody, 1)}\n}`);
    }
    return blocks.join("\n\n");
};

/**
 * Inputs for {@link renderGetterBody}.
 */
type GetterBodyOptions = {
    readonly context: ModuleContext;
    readonly property: GirProperty;
    readonly getterMember: string | undefined;
    readonly getMethod: GirFunction | undefined;
    readonly tsType: string;
};

/**
 * Renders a property getter body.
 *
 * The property type follows the setter's parameter (what callers may assign),
 * so a getter whose own GIR nullability differs is narrowed to it with a single
 * assertion; matching nullability needs no cast. Properties with no typed
 * getter read through the generic `getProperty` GValue path.
 *
 * @param options - {@link GetterBodyOptions}
 */
const renderGetterBody = (options: GetterBodyOptions): string => {
    const { context, property, getterMember, getMethod, tsType } = options;
    if (getterMember === undefined) return `return this.getProperty(${quote(property.name)}) as ${tsType};`;
    if (getMethod === undefined) return `return this.${getterMember}() as ${tsType};`;
    const getType = renderMethodReturnType(context, getMethod);
    return getType === tsType ? `return this.${getterMember}();` : `return this.${getterMember}() as ${tsType};`;
};

/**
 * Resolves a property's GIR `getter`/`setter` method name to the camelCase
 * member to delegate the accessor to, or `undefined` to fall back to the
 * generic `getProperty`/`setProperty` GValue path.
 *
 * Delegation is used only when the named method was actually emitted on the
 * class (so object, interface, and boxed values marshal through their typed
 * setter rather than the GValue `valueFromJS` path) and the member name does
 * not collide with the accessor itself, which would recurse.
 *
 * @param accessorName - The accessor's own camelCase member name
 * @param attribute - The GIR `getter`/`setter` attribute, if present
 * @param claimedNames - Names already emitted as methods on the class
 */
const delegateMember = (
    attribute: string | undefined,
    accessorName: string,
    claimedNames: ReadonlySet<string>,
): string | undefined => {
    if (attribute === undefined) return undefined;
    const member = toCamelCase(attribute);
    if (member === accessorName) return undefined;
    if (!claimedNames.has(member)) return undefined;
    return member;
};
