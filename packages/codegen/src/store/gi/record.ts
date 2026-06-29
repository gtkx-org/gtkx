import type { GirRecord } from "../../gir/record.js";
import type { ModuleContext } from "../../writer/context.js";
import { indentMembers } from "../../writer/emit.js";
import { type Callables, dedupeCallables, generateBindings, renderPlainTypeMembers } from "./callables.js";
import { isClassStructRecord } from "./class-struct-record.js";
import { gtypeExprFor } from "./gtype-binding.js";
import { renderRecordConstructor, renderRecordConstructorPropsInterface } from "./record-constructor.js";
import { renderRecordFieldAccessor } from "./record-field-accessor.js";
import { computeRecordFieldSlots } from "./record-layout.js";
import { appendWrapperClassRegistration } from "./registration.js";

export const generateRecord = (context: ModuleContext, record: GirRecord): void => {
    if (!record.introspectable) return;
    if (record.isVtable) return;
    if (record.name.length === 0) return;
    if (isClassStructRecord(context.library, context.namespace.name, record)) return;
    const className = record.name;
    const callables: Callables = {
        constructors: dedupeCallables(record.constructors),
        functions: dedupeCallables(record.functions),
        methods: dedupeCallables(record.methods),
    };
    generateBindings(context, callables);

    const members = renderRecordMembers(context, record, className, callables);
    const body = indentMembers(members);
    context.module.appendDeclaration(`export class ${className} {\n${body}\n}`);
    context.module.appendDeclaration(renderRecordConstructorPropsInterface(context, record, className));

    const gtypeExpr = gtypeExprFor(context, record);
    appendWrapperClassRegistration(context, {
        className,
        gtypeExpr,
    });
};

const renderRecordMembers = (
    context: ModuleContext,
    record: GirRecord,
    className: string,
    callables: Callables,
): string[] => {
    const { members, claimedNames } = renderPlainTypeMembers({
        context,
        className,
        callables,
        hasGtype: record.glibGetType !== undefined,
    });
    members.unshift(renderRecordConstructor(context, record, className));
    const { slots } = computeRecordFieldSlots(context, record.fields, record.isUnion);
    for (const slot of slots) {
        const block = renderRecordFieldAccessor(context, slot, claimedNames, record.fields);
        if (block !== undefined) members.push(block);
    }
    return members;
};
