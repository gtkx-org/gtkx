import { type GirParameter, type GirReturnValue, parameterFromNode, returnValueFromNode } from "./parameter.js";
import { attr, attrBool, childOf, childrenOf, type RawNode } from "./parse.js";

/**
 * Whether this callable is a free function, a static method on a type, an
 * instance method, a constructor, or a virtual method.
 *
 * The kind controls call-site shape in the writers: instance methods pass
 * `self` as the first FFI argument, constructors return a fresh native
 * handle, etc.
 */
export type FunctionKind = "function" | "method" | "constructor" | "virtual-method";

/**
 * A callable declaration: `<function>`, `<method>`, `<constructor>`, or
 * `<virtual-method>`.
 */
export type GirFunction = {
    readonly kind: FunctionKind;
    /** GIR `name`, snake_case (e.g. `"set_label"`). */
    readonly name: string;
    /** C symbol identifier passed to `t.fn(library, symbol, …)`. */
    readonly cIdentifier: string | undefined;
    /** `throws="1"` — appends an implicit `GError**` out-parameter. */
    readonly throws: boolean;
    /** `introspectable="0"` — the function is skipped in JS output. */
    readonly introspectable: boolean;
    /** Indicates the function is the preferred binding for the named method. */
    readonly shadows: string | undefined;
    /** Indicates a different function is the preferred binding (the shadower). */
    readonly shadowedBy: string | undefined;
    /** Marker that re-homes a namespace function onto a type method. */
    readonly movedTo: string | undefined;
    /** The instance parameter for methods; `undefined` otherwise. */
    readonly instance: GirParameter | undefined;
    /** Regular parameters (no instance and no implicit GError). */
    readonly parameters: readonly GirParameter[];
    readonly returnValue: GirReturnValue;
    /** Linked invoker method when this is a `<virtual-method>`. */
    readonly invoker: string | undefined;
};

/**
 * Builds a {@link GirFunction} from a callable element.
 *
 * @param node - The XML element
 * @param kind - The callable kind matching the element name
 */
export const functionFromNode = (node: RawNode, kind: FunctionKind): GirFunction => {
    const parametersNode = childOf(node, "parameters");
    const instanceNode = childOf(parametersNode, "instance-parameter");
    const parameterNodes = childrenOf(parametersNode, "parameter");
    return {
        kind,
        name: attr(node, "shadows") ?? attr(node, "name") ?? "",
        cIdentifier: attr(node, "c:identifier"),
        throws: attrBool(node, "throws"),
        introspectable: attr(node, "introspectable") !== "0",
        shadows: attr(node, "shadows"),
        shadowedBy: attr(node, "shadowed-by"),
        movedTo: attr(node, "moved-to"),
        instance: instanceNode === undefined ? undefined : parameterFromNode(instanceNode, true),
        parameters: parameterNodes.map((parameter) => parameterFromNode(parameter, false)),
        returnValue: returnValueFromNode(childOf(node, "return-value")),
        invoker: attr(node, "invoker"),
    };
};
