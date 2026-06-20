import type { ModuleContext } from "../dsl/context.js";
import { indentMembers } from "../dsl/emit.js";
import type { GirBoxed } from "../gir/boxed.js";
import { renderBoxedConstructor, renderBoxedConstructorPropsInterface } from "./boxed-constructor.js";
import { renderBoxedFieldAccessor } from "./boxed-field-accessor.js";
import { computeBoxedFieldSlots } from "./boxed-layout.js";
import { type Callables, dedupeCallables, emitBindings, renderPlainTypeMembers } from "./callables.js";
import { isClassStructRecord } from "./class-struct-record.js";
import { gtypeExprFor } from "./gtype-binding.js";
import { appendWrapperClassRegistration } from "./registration.js";

export const emitBoxed = (context: ModuleContext, boxed: GirBoxed): void => {
    if (!boxed.introspectable) return;
    if (boxed.isVtable) return;
    if (boxed.name.length === 0) return;
    if (isClassStructRecord(context.repository, context.namespace.name, boxed)) return;
    const className = boxed.name;
    const callables: Callables = {
        constructors: dedupeCallables(boxed.constructors),
        functions: dedupeCallables(boxed.functions),
        methods: dedupeCallables(boxed.methods),
    };
    emitBindings(context, callables);

    const members = renderBoxedMembers(context, boxed, className, callables);
    const body = indentMembers(members);
    context.module.appendDeclaration(`export class ${className} {\n${body}\n}`);
    context.module.appendDeclaration(renderBoxedConstructorPropsInterface(context, boxed, className));

    const gtypeExpr = gtypeExprFor(context, boxed);
    appendWrapperClassRegistration(context, {
        className,
        gtypeExpr,
    });
};

const renderBoxedMembers = (
    context: ModuleContext,
    boxed: GirBoxed,
    className: string,
    callables: Callables,
): string[] => {
    const { members, claimedNames } = renderPlainTypeMembers({
        context,
        className,
        callables,
        hasGtype: boxed.glibGetType !== undefined,
    });
    members.unshift(renderBoxedConstructor(context, boxed, className));
    const { slots } = computeBoxedFieldSlots(context, boxed.fields, boxed.isUnion);
    for (const slot of slots) {
        const block = renderBoxedFieldAccessor(context, slot, claimedNames, boxed.fields);
        if (block !== undefined) members.push(block);
    }
    return members;
};
