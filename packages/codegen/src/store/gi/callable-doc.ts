import type { GirCallable } from "../../gir/parameter.js";
import type { ModuleContext } from "../../writer/context.js";
import { nulTerminatedByteParams } from "../../analysis/nul-terminated-bytes.js";
import { renderJsDoc } from "../../writer/doc.js";

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

const callableDoc = (context: ModuleContext, callable: GirCallable): string =>
    renderJsDoc(callable.doc, nulTerminatedNote(context, callable));

export { callableDoc };
