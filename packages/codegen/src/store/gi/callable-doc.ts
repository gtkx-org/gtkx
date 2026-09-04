import { toCamelIdentifier } from "@gtkx/utils";
import type { GirFunction } from "../../gir/function.js";
import type { GirCallable } from "../../gir/parameter.js";
import type { ModuleContext } from "../../writer/context.js";
import type { JsDocSpec } from "../../writer/doc.js";
import { shouldOmitPrimaryReturn } from "../../analysis/descriptor-render.js";
import { nulTerminatedByteParams } from "../../analysis/nul-terminated-bytes.js";
import {
    documentedParameters,
    type InputParameter,
    parameterIdentifier,
    renamesWithInstance,
} from "../../analysis/param-structure.js";
import { renderJsDoc } from "../../writer/doc.js";
import { externalFinishOwner } from "./async.js";
import { annotationSpec, THROWS_TEXT } from "./doc-spec.js";
import { isCallbackParameter, returnedOutParameters, shouldTrimFinishBoolean } from "./method.js";

type CallableDocOptions = {
    finishFn?: GirFunction | undefined;
    renames?: Map<string, string> | undefined;
};

const WHITESPACE_RUN_PATTERN = /\s+/g;

const callbackFinishNote = (
    context: ModuleContext,
    callable: GirFunction,
    finishFn: GirFunction | undefined,
): string | undefined => {
    if (finishFn !== undefined) {
        return undefined;
    }

    const owner = externalFinishOwner(context.library, callable);

    if (owner === undefined) {
        return undefined;
    }

    const declared = `${owner.namespaceName}.${owner.typeName}.${toCamelIdentifier(owner.member.name)}`;

    return `Callback-based: the GIR declares \`${declared}\` as its finish function, on another class, ` +
        "and no finish method of this class pairs with it. Call it only on the instance that owns the result " +
        "(`Gio.Task.isValid(result, owner)`); an unrelated instance is not a valid receiver.";
};

const callableNote = (
    context: ModuleContext,
    callable: GirFunction,
    finishFn: GirFunction | undefined,
): string | undefined => {
    const notes = [
        nulTerminatedNote(context, callable),
        callbackFinishNote(context, callable, finishFn),
    ].filter((note): note is string => note !== undefined);

    return notes.length === 0 ? undefined : notes.join("\n\n");
};

const nulTerminatedNote = (context: ModuleContext, callable: GirCallable): string | undefined => {
    const parameters = nulTerminatedByteParams(context.library, callable);

    if (parameters.length === 0) {
        return undefined;
    }

    const names = parameters.map((parameter) => `\`${parameter.name}\``).join(", ");

    return [
        `The C function reads ${names} as a NUL-terminated string, so it stops at the`,
        "first zero byte and drops every byte after it without reporting an error.",
        "Pass binary data through a `GLib.Bytes` route such as `GLib.Variant.newFromBytes`",
        "instead.",
    ].join("\n");
};

const tupleBullet = (name: string, doc: string | undefined): string | undefined => {
    const text = (doc ?? "").replaceAll(WHITESPACE_RUN_PATTERN, " ").trim();

    return text.length === 0 ? undefined : `- \`${name}\`: ${text}`;
};

const tupleReturnsText = (primary: string | undefined, outs: InputParameter[]): string | undefined => {
    const bullets = [
        tupleBullet("result", primary),
        ...outs.map(({ parameter, index }) => tupleBullet(parameterIdentifier(parameter, index), parameter.doc)),
    ].filter((bullet) => bullet !== undefined);

    return bullets.length === 0 ? undefined : `Tuple of:\n\n${bullets.join("\n")}`;
};

const returnsText = (context: ModuleContext, fn: GirFunction, isPrimaryTrimmed: boolean): string | undefined => {
    const outs = returnedOutParameters(context, fn);
    const isPrimaryOmitted = isPrimaryTrimmed || shouldOmitPrimaryReturn(context.library, fn.returnValue);
    const primary = isPrimaryOmitted ? undefined : fn.returnValue.doc;

    if (outs.length === 0) {
        return primary;
    }

    if (isPrimaryOmitted && outs.length === 1) {
        return outs[0]?.parameter.doc;
    }

    return tupleReturnsText(primary, outs);
};

const docIdentifiers = (callable: GirFunction, renames: Map<string, string> | undefined): Map<string, string> => {
    const identifiers = renamesWithInstance(callable.parameters, callable.instance);
    const overrides = renames ?? new Map<string, string>();

    for (const [girName, declaredName] of overrides) {
        identifiers.set(girName, declaredName);
    }

    return identifiers;
};

const canCallableThrow = (callable: GirFunction, finishFn: GirFunction | undefined): boolean =>
    callable.throws || finishFn?.throws === true;

const callableSpec = (context: ModuleContext, callable: GirFunction, options: CallableDocOptions): JsDocSpec => ({
    ...annotationSpec(callable.annotations),
    identifiers: docIdentifiers(callable, options.renames),
    params: documentedParameters(
        context.library,
        callable,
        (parameter) => options.finishFn !== undefined && isCallbackParameter(context, parameter),
        options.renames,
    ),
    returns: returnsText(
        context,
        options.finishFn ?? callable,
        options.finishFn !== undefined && shouldTrimFinishBoolean(context, options.finishFn),
    ),
    throws: canCallableThrow(callable, options.finishFn) ? THROWS_TEXT : undefined,
});

const callableDoc = (context: ModuleContext, callable: GirFunction, options: CallableDocOptions = {}): string =>
    renderJsDoc(
        callable.doc,
        callableNote(context, callable, options.finishFn),
        callableSpec(context, callable, options),
    );

export { callableDoc, callableNote, callableSpec };
