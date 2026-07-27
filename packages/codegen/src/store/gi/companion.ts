import { pascalCase } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { ModuleContext } from "../../writer/context.js";
import { splitOptionalNamespace } from "../../gir/type-ref.js";

const parentCompanionRef = (context: ModuleContext, klass: GirClass, suffix: string): string | undefined => {
    if (klass.parent === undefined) {
        return undefined;
    }

    const [parentNamespace, typeName] = splitOptionalNamespace(klass.parent);
    const namespaceName = parentNamespace ?? context.namespace.name;
    const name = `${pascalCase(typeName)}${suffix}`;

    if (namespaceName === context.namespace.name) {
        return name;
    }

    return `${context.addCrossNamespaceImport(namespaceName)}.${name}`;
};

export { parentCompanionRef };
