import type { ModuleContext } from "../dsl/context.js";
import { indent, quote } from "../dsl/emit.js";
import { camelCase, camelCaseMember } from "../dsl/identifier.js";
import type { GirProperty } from "../gir/property.js";
import { writeTsType } from "./types-ts.js";

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
 * @param ctx - The module context
 * @param property - The property to surface
 * @param claimedMemberNames - Names already used by emitted methods
 */
export const renderPropertyAccessor = (
    ctx: ModuleContext,
    property: GirProperty,
    claimedMemberNames: ReadonlySet<string>,
): string | undefined => {
    const jsName = camelCase(property.name);
    if (claimedMemberNames.has(jsName)) return undefined;
    if (jsName === "constructor") return undefined;
    const tsType = writeTsType(ctx, property.type, true);
    const blocks: string[] = [];
    const getterBody = delegateMember(property.getter, jsName, claimedMemberNames) ?? undefined;
    const getBody =
        getterBody !== undefined
            ? `return this.${getterBody}() as ${tsType};`
            : `return this.getProperty(${quote(property.name)}) as ${tsType};`;
    blocks.push(`get ${jsName}(): ${tsType} {\n${indent(getBody, 1)}\n}`);
    if (property.writable || property.construct || property.constructOnly) {
        const setterMember = delegateMember(property.setter, jsName, claimedMemberNames);
        const setBody =
            setterMember !== undefined
                ? `this.${setterMember}(value);`
                : `this.setProperty(${quote(property.name)}, value);`;
        blocks.push(`set ${jsName}(value: ${tsType}) {\n${indent(setBody, 1)}\n}`);
    }
    return blocks.join("\n\n");
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
 * @param claimedMemberNames - Names already emitted as methods on the class
 */
const delegateMember = (
    attribute: string | undefined,
    accessorName: string,
    claimedMemberNames: ReadonlySet<string>,
): string | undefined => {
    if (attribute === undefined) return undefined;
    const member = camelCaseMember(attribute);
    if (member === accessorName) return undefined;
    if (!claimedMemberNames.has(member)) return undefined;
    return member;
};
