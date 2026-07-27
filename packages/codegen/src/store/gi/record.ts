import type { GirRecord } from "../../gir/record.js";
import type { ModuleContext } from "../../writer/context.js";
import { renderJsDoc } from "../../writer/doc.js";
import { indentMembers } from "../../writer/emit.js";
import { type Callables, dedupeCallables, generateBindings, renderPlainTypeMembers } from "./callables.js";
import { isClassStructRecord } from "./class-struct-record.js";
import { renderSourceGtype } from "./gtype-binding.js";
import { renderRecordConstructor, renderRecordConstructorPropsInterface } from "./record-constructor.js";
import { renderRecordFieldAccessor } from "./record-field-accessor.js";
import { computeRecordFieldSlots } from "./record-layout.js";
import { appendWrapperClassRegistration } from "./registration.js";

const isGErrorRecord = (context: ModuleContext, record: GirRecord): boolean =>
    context.namespace.name === "GLib" && record.glibGetType === "g_error_get_type";

const generateRecord = (context: ModuleContext, record: GirRecord): void => {
    if (!record.introspectable) {
        return;
    }

    if (record.isVtable) {
        return;
    }

    if (record.name.length === 0) {
        return;
    }

    if (isClassStructRecord(context.library, context.namespace.name, record)) {
        return;
    }

    const className = record.name;
    const isErrorSubclass = isGErrorRecord(context, record);

    const callables: Callables = {
        constructors: dedupeCallables(record.constructors),
        functions: dedupeCallables(record.functions),
        methods: dedupeCallables(record.methods),
    };

    generateBindings(context, callables);
    const members = renderRecordMembers(context, record, className, callables);
    const body = indentMembers(members);
    const heritage = isErrorSubclass ? " extends globalThis.Error" : "";
    context.module.appendDeclaration(`${renderJsDoc(record.doc)}export class ${className}${heritage} {\n${body}\n}`);
    context.module.appendDeclaration(renderRecordConstructorPropsInterface(context, record, className));
    const gtypeExpr = renderSourceGtype(context, record);

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
    const isErrorSubclass = isGErrorRecord(context, record);

    const { members, claimedNames } = renderPlainTypeMembers({
        context,
        className,
        callables,
        hasGtype: record.glibGetType !== undefined,
    });

    members.unshift(renderRecordConstructor(context, record, className, isErrorSubclass));
    const { slots } = computeRecordFieldSlots(context, record.fields, record.isUnion);

    for (const slot of slots) {
        const block = renderRecordFieldAccessor(context, slot, claimedNames, record.fields);

        if (block !== undefined) {
            members.push(block);
        }
    }

    if (isErrorSubclass) {
        members.push('get name(): string {\n    return "GLib.Error";\n}');
    }

    return members;
};

export { generateRecord };
