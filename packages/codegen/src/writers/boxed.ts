import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";
import { pascalCase } from "../dsl/identifier.js";
import type { GirBoxed } from "../gir/boxed.js";
import { computeBoxedFieldSlots, renderBoxedFieldAccessor } from "./boxed-field-accessor.js";
import { buildPlainTypeMembers, type Callables, dedupeCallables, emitBindings } from "./callables.js";
import { emitBoxedConstructionMeta } from "./construction-meta.js";
import { renderGetTypeCall } from "./gtype-binding.js";

/**
 * Emits a class declaration plus optional boxed registration for a
 * `<record>`, `<union>`, or `<glib:boxed>`.
 *
 * Walks constructors, static functions, and methods just like
 * {@link emitClass}, attaching them to the boxed class. Field accessors
 * and construction metadata are emitted by their dedicated writers.
 *
 * Vtable records (`glib:is-gtype-struct-for`) are skipped here — they are
 * consumed by the owning class's vtable registration.
 *
 * @param ctx - The module context
 * @param boxed - The boxed to emit
 */
export const emitBoxed = (ctx: ModuleContext, boxed: GirBoxed): void => {
    if (!boxed.introspectable) return;
    if (boxed.flavor === "vtable") return;
    if (boxed.name.length === 0) return;
    ctx.addConstructNativeObjectImport();
    const className = pascalCase(boxed.name);
    const callables: Callables = {
        constructors: dedupeCallables(boxed.constructors),
        functions: dedupeCallables(boxed.functions),
        methods: dedupeCallables(boxed.methods),
    };
    emitBindings(ctx, callables);

    const members = buildBoxedMembers(ctx, boxed, className, callables);
    const body = members.map((member) => indent(member, 1)).join("\n\n");
    ctx.module.appendDeclaration(`export class ${className} {\n${body}\n}`);

    if (boxed.glibGetType !== undefined) {
        const gtypeCall = renderGetTypeCall(ctx, boxed.glibGetType, boxed.glibTypeName);
        if (gtypeCall !== undefined) {
            ctx.addRuntimeImport("registerNativeClass");
            ctx.module.appendRegistration(`${className}.prototype.__gtype__ = 0;`);
            ctx.module.appendRegistration(`registerNativeClass(${className}, ${gtypeCall});`);
        }
    }
    emitBoxedConstructionMeta(ctx, boxed);
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
    const { slots } = computeBoxedFieldSlots(ctx, boxed.fields, boxed.isUnion);
    for (const slot of slots) {
        const block = renderBoxedFieldAccessor(ctx, slot, claimedNames, boxed.fields);
        if (block !== undefined) members.push(block);
    }
    return members;
};
