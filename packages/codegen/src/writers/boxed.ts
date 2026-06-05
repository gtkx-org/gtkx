import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";
import type { GirBoxed } from "../gir/boxed.js";
import { renderBoxedConstructor, renderBoxedConstructorPropsInterface } from "./boxed-constructor.js";
import { renderBoxedFieldAccessor } from "./boxed-field-accessor.js";
import { computeBoxedFieldSlots } from "./boxed-layout.js";
import { type Callables, dedupeCallables, emitBindings, renderPlainTypeMembers } from "./callables.js";
import { isClassStructRecord } from "./class-struct-record.js";
import { renderGetTypeReference } from "./gtype-binding.js";
import { appendNativeClassRegistration } from "./registration.js";

/**
 * Emits a class declaration plus optional boxed registration for a
 * `<record>` or `<union>`.
 *
 * Walks constructors, static functions, and methods just like
 * {@link emitClass}, attaching them to the boxed class. The typed
 * constructor ({@link renderBoxedConstructor}), its
 * {@link renderBoxedConstructorPropsInterface} props interface, and the
 * field accessors are emitted by their dedicated writers.
 *
 * Vtable records (`glib:is-gtype-struct-for`) are skipped here — they are
 * consumed by the owning class's vtable registration. Class- and
 * interface-struct records (`GTypeClass`, `GEnumClass`, …) are likewise skipped
 * as they are runtime vtables rather than marshallable values.
 *
 * @param context - The module context
 * @param boxed - The boxed to emit
 */
export const emitBoxed = (context: ModuleContext, boxed: GirBoxed): void => {
    if (!boxed.introspectable) return;
    if (boxed.kind === "vtable") return;
    if (boxed.name.length === 0) return;
    if (isClassStructRecord(context.namespace.name, boxed)) return;
    const className = boxed.name;
    const callables: Callables = {
        constructors: dedupeCallables(boxed.constructors),
        functions: dedupeCallables(boxed.functions),
        methods: dedupeCallables(boxed.methods),
    };
    emitBindings(context, callables);

    const members = renderBoxedMembers(context, boxed, className, callables);
    const body = members.map((member) => indent(member, 1)).join("\n\n");
    context.module.appendDeclaration(`export class ${className} {\n${body}\n}`);
    context.module.appendDeclaration(renderBoxedConstructorPropsInterface(context, boxed, className));

    const getTypeRef =
        boxed.glibGetType === undefined
            ? undefined
            : renderGetTypeReference(context, boxed.glibGetType, boxed.glibTypeName);
    appendNativeClassRegistration(context, {
        className,
        role: "boxed",
        getTypeRef,
    });
};

const renderBoxedMembers = (
    context: ModuleContext,
    boxed: GirBoxed,
    className: string,
    callables: Callables,
): readonly string[] => {
    const { members, claimedNames } = renderPlainTypeMembers({
        context,
        className,
        callables,
        hasGType: boxed.glibGetType !== undefined,
        wrap: "boxed",
    });
    members.unshift(renderBoxedConstructor(context, boxed, className));
    const { slots } = computeBoxedFieldSlots(context, boxed.fields, boxed.isUnion);
    for (const slot of slots) {
        const block = renderBoxedFieldAccessor(context, slot, claimedNames, boxed.fields);
        if (block !== undefined) members.push(block);
    }
    return members;
};
