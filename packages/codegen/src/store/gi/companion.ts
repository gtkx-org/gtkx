import { sanitizeTypeIdentifier } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { ModuleContext } from "../../writer/context.js";
import { getParentRef } from "../../gir/ancestry.js";

const parentCompanionRef = (context: ModuleContext, klass: GirClass, suffix: string): string | undefined => {
    const parent = getParentRef(klass);

    if (parent === undefined) {
        return undefined;
    }

    const namespaceName = parent.namespaceName ?? context.namespace.name;
    const name = `${sanitizeTypeIdentifier(parent.typeName)}${suffix}`;

    if (namespaceName === context.namespace.name) {
        return name;
    }

    return `${context.addCrossNamespaceImport(namespaceName)}.${name}`;
};

export { parentCompanionRef };
