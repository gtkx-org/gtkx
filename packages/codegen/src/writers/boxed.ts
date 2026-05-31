import { toPascalCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";
import type { GirBoxed } from "../gir/boxed.js";
import { renderBoxedConstructor, renderBoxedConstructorPropsInterface } from "./boxed-constructor.js";
import { renderBoxedFieldAccessor } from "./boxed-field-accessor.js";
import { computeBoxedFieldSlots } from "./boxed-layout.js";
import { buildPlainTypeMembers, type Callables, dedupeCallables, emitBindings } from "./callables.js";
import { isClassStructRecord } from "./class-struct-record.js";
import { renderGetTypeReference } from "./gtype-binding.js";
import { appendNativeClassRegistration } from "./registration.js";

/**
 * Emits a class declaration plus optional boxed registration for a
 * `<record>`, `<union>`, or `<glib:boxed>`.
 *
 * Walks constructors, static functions, and methods just like
 * {@link emitClass}, attaching them to the boxed class. Field accessors
 * and construction metadata are emitted by their dedicated writers.
 *
 * Vtable records (`glib:is-gtype-struct-for`) are skipped here — they are
 * consumed by the owning class's vtable registration. Class- and
 * interface-struct records (`GTypeClass`, `GEnumClass`, …) are likewise skipped
 * as they are runtime vtables rather than marshallable values.
 *
 * @param ctx - The module context
 * @param boxed - The boxed to emit
 */
export const emitBoxed = (ctx: ModuleContext, boxed: GirBoxed): void => {
    if (!boxed.introspectable) return;
    if (boxed.flavor === "vtable") return;
    if (boxed.name.length === 0) return;
    if (isClassStructRecord(ctx.namespace.name, boxed)) return;
    const className = toPascalCase(boxed.name);
    const callables: Callables = {
        constructors: dedupeCallables(boxed.constructors),
        functions: dedupeCallables(boxed.functions),
        methods: dedupeCallables(boxed.methods),
    };
    emitBindings(ctx, callables);

    const members = buildBoxedMembers(ctx, boxed, className, callables);
    const body = members.map((member) => indent(member, 1)).join("\n\n");
    ctx.module.appendDeclaration(`export class ${className} {\n${body}\n}`);
    ctx.module.appendDeclaration(renderBoxedConstructorPropsInterface(ctx, boxed, className));

    const getTypeRef =
        boxed.glibGetType === undefined
            ? undefined
            : renderGetTypeReference(ctx, boxed.glibGetType, boxed.glibTypeName);
    appendNativeClassRegistration(ctx, {
        className,
        role: "boxed",
        getTypeRef,
    });
};

const buildBoxedMembers = (
    ctx: ModuleContext,
    boxed: GirBoxed,
    className: string,
    callables: Callables,
): readonly string[] => {
    const { members, claimedNames } = buildPlainTypeMembers({
        ctx,
        className,
        callables,
        hasGType: boxed.glibGetType !== undefined,
    });
    members.unshift(renderBoxedConstructor(ctx, boxed, className));
    const { slots } = computeBoxedFieldSlots(ctx, boxed.fields, boxed.isUnion);
    for (const slot of slots) {
        const block = renderBoxedFieldAccessor(ctx, slot, claimedNames, boxed.fields);
        if (block !== undefined) members.push(block);
    }
    return members;
};
