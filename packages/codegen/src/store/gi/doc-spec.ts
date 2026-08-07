import type { GirAnnotations } from "../../gir/annotations.js";
import type { GirCallable, GirParameter } from "../../gir/parameter.js";
import type { JsDocSpec } from "../../writer/doc.js";
import { documentedHandlerParameters, handlerRenames } from "../../analysis/param-structure.js";
import { renderJsDoc } from "../../writer/doc.js";

type DocumentedNode = { doc: string | undefined; annotations: GirAnnotations };

const SELF_PARAM_DOC = "The instance the signal was emitted on.";
const THROWS_TEXT = "A `GLib.Error` carrying the failing operation's domain, code, and message.";

const annotationSpec = (annotations: GirAnnotations): JsDocSpec => ({
    deprecated: annotations.isDeprecated
        ? { since: annotations.deprecatedSince, doc: annotations.deprecationDoc }
        : undefined,
    since: annotations.since,
});

const getDoc = (node: DocumentedNode): string => renderJsDoc(node.doc, undefined, annotationSpec(node.annotations));

const handlerSpec = (
    callable: GirCallable,
    parameters: GirParameter[],
    identifiers?: Map<string, string>,
): JsDocSpec => ({
    ...annotationSpec(callable.annotations),
    identifiers: identifiers ?? handlerRenames(parameters),
    params: documentedHandlerParameters(parameters),
    returns: callable.returnValue.doc,
});

const selfHandlerSpec = (signal: GirCallable): JsDocSpec => {
    const spec = handlerSpec(signal, signal.parameters);

    return { ...spec, params: [...(spec.params ?? []), { name: "self", doc: SELF_PARAM_DOC }] };
};

export { annotationSpec, getDoc, handlerSpec, selfHandlerSpec, THROWS_TEXT };
