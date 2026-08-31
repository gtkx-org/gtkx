import { sanitizeTypeIdentifier } from "@gtkx/utils";
import type { GirRecord } from "../../gir/record.js";
import type { ModuleContext } from "../../writer/context.js";
import { isEmittableEntity } from "../../gir/emittable.js";
import { indentMembers } from "../../writer/emit.js";
import { type Callables, dedupeCallables, generateBindings, renderPlainTypeMembers } from "./callables.js";
import { getDoc } from "./doc-spec.js";
import { declareFoldedClass, localClassName } from "./folded.js";
import { renderSourceGtype } from "./gtype-binding.js";
import { renderRecordConstructor, renderRecordConstructorPropsInterface } from "./record-constructor.js";
import { renderRecordFieldAccessor } from "./record-field-accessor.js";
import { computeRecordFieldSlots } from "./record-layout.js";
import { appendWrapperClassRegistration } from "./registration.js";
import { isConstructibleRecord } from "./value-marshalable.js";

type FoldedRecordOptions = {
    record: GirRecord;
    className: string;
    doc: string;
    modifier: string;
    heritage: string;
    body: string;
    gtypeExpr: string;
};

const isGErrorRecord = (context: ModuleContext, record: GirRecord): boolean =>
    context.namespace.name === "GLib" && record.glibGetType === "g_error_get_type";

const recordHeritage = (context: ModuleContext, isErrorSubclass: boolean): string => {
    if (!isErrorSubclass) {
        return "";
    }

    const base = context.hoistBaseRef("globalThis.Error");

    return ` extends ${base}`;
};

const recordModifier = (isConstructible: boolean): string => (isConstructible ? "" : "abstract ");

const declareFoldedRecord = (context: ModuleContext, options: FoldedRecordOptions): void => {
    const { record, className, doc, modifier, heritage, body, gtypeExpr } = options;
    const localName = localClassName(className);

    appendWrapperClassRegistration(context, {
        className: localName,
        gtypeExpr,
    });

    declareFoldedClass({
        context,
        className,
        doc,
        owner: record.name,
        localDeclaration: `${modifier}class ${localName}${heritage} {\n${body}\n}`,
        registrations: context.takeRegistrations(),
        hasInstanceInterface: true,
    });
};

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
    const members = renderRecordMembers(context, record, className, callables);
    const body = indentMembers(members);
    const heritage = recordHeritage(context, isErrorSubclass);
    const doc = getDoc(record);
    const isConstructible = isConstructibleRecord(context, context.namespace.name, record);
    const modifier = recordModifier(isConstructible);
    const gtypeExpr = renderSourceGtype(context, record);

    if (gtypeExpr === undefined) {
        context.declare({
            name: className,
            code: `${doc}export ${modifier}class ${className}${heritage} {\n${body}\n}`,
            owner: record.name,
        });
    } else {
        declareFoldedRecord(context, { record, className, doc, modifier, heritage, body, gtypeExpr });
    }

    if (isConstructible) {
        context.declare({
            name: `${className}ConstructorProps`,
            code: renderRecordConstructorPropsInterface(context, record, className),
        });
    }
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
