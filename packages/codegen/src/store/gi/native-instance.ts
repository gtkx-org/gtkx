import { sanitizeTypeIdentifier } from "@gtkx/utils";
import type { ModuleContext } from "../../writer/context.js";

const nativeIdentityMember = (context: ModuleContext, typeName: string): string => {
    const name = `_${sanitizeTypeIdentifier(typeName)}$native`;
    const type = context.addRuntimeTypeImport("NativeIdentity");
    context.module.appendDeclaration({
        name,
        code: `declare const ${name}: unique symbol;`,
        isLocal: true,
    });

    return `readonly [${name}]: ${type};`;
};

export { nativeIdentityMember };
