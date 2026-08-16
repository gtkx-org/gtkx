import { sanitizeTypeIdentifier } from "@gtkx/utils";
import type { GirRecord } from "../../gir/record.js";
import type { ModuleContext } from "../../writer/context.js";
import { isEmittableEntity } from "../../gir/emittable.js";
import { indentMembers } from "../../writer/emit.js";
import { type Callables, dedupeCallables, generateBindings, renderPlainTypeMembers } from "./callables.js";
import { getDoc } from "./doc-spec.js";
import { renderSourceGtype } from "./gtype-binding.js";
import { renderRecordConstructor, renderRecordConstructorPropsInterface } from "./record-constructor.js";
import { renderRecordFieldAccessor } from "./record-field-accessor.js";
import { computeRecordFieldSlots } from "./record-layout.js";
import { appendWrapperClassRegistration } from "./registration.js";
import { isConstructibleRecord } from "./value-marshalable.js";

type RecordMembersOptions = {
    context: ModuleContext;
    record: GirRecord;
    className: string;
    callables: Callables;
    gtypeExpr: string | undefined;
};

const isGErrorRecord = (context: ModuleContext, record: GirRecord): boolean =>
    context.namespace.name === "GLib" && record.glibGetType === "g_error_get_type";

const generateRecord = (context: ModuleContext, record: GirRecord): void => {
    if (!isEmittableEntity(record)) {
        return;
    }

    const className = sanitizeTypeIdentifier(record.name);
    const isErrorSubclass = isGErrorRecord(context, record);

    const callables: Callables = {
        constructors: dedupeCallables(record.constructors),
        functions: dedupeCallables(record.functions),
        methods: dedupeCallables(record.methods),
    };

    generateBindings(context, callables);
    const gtypeExpr = renderSourceGtype(context, record);
    const members = renderRecordMembers({ context, record, className, callables, gtypeExpr });
    const body = indentMembers(members);
    const heritage = isErrorSubclass ? " extends globalThis.Error" : "";
    const doc = getDoc(record);
    const isConstructible = isConstructibleRecord(context, context.namespace.name, record);
    const modifier = isConstructible ? "" : "abstract ";

    context.declare({
        name: className,
        code: `${doc}export ${modifier}class ${className}${heritage} {\n${body}\n}`,
        owner: record.name,
    });

    if (isConstructible) {
        context.declare({
            name: `${className}ConstructorProps`,
            code: renderRecordConstructorPropsInterface(context, record, className),
        });
    }

    appendWrapperClassRegistration(context, {
        className,
        gtypeExpr,
    });
};

const renderRecordMembers = (options: RecordMembersOptions): string[] => {
    const { context, record, className, callables, gtypeExpr } = options;
    const isErrorSubclass = isGErrorRecord(context, record);
    const { members, claimedNames } = renderPlainTypeMembers({ context, className, callables, gtypeExpr });
    members.unshift(renderRecordConstructor(context, { record, className, callables, isErrorSubclass }));
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
