import { sourceStringLiteral } from "@gtkx/utils";
import type { ModuleContext } from "../../writer/context.js";
import { indent } from "../../writer/emit.js";

type FoldedClassOptions = {
    context: ModuleContext;
    className: string;
    doc: string;
    owner: string;
    localDeclarations: string[];
    registrations: string[];
    hasTypeAlias: boolean;
};

const localClassName = (className: string): string => `_${className}`;

const renderNameStatement = (className: string): string =>
    `globalThis.Object.defineProperty(${localClassName(className)}, "name", ` +
    `{ value: ${sourceStringLiteral(className)}, configurable: true });`;

const declareFoldedClass = (options: FoldedClassOptions): void => {
    const { context, className, doc, owner, localDeclarations, registrations, hasTypeAlias } = options;
    const localName = localClassName(className);

    for (const code of localDeclarations) {
        context.module.appendDeclaration({ name: localName, code, isLocal: true });
    }

    const body = [renderNameStatement(className), ...registrations, `return ${localName};`]
        .map((statement) => indent(statement, 1))
        .join("\n");

    context.declare({
        name: className,
        code: `${doc}export const ${className}: typeof ${localName} = /* @__PURE__ */ (() => {\n${body}\n})();`,
        owner,
    });

    if (hasTypeAlias) {
        context.declare({
            name: className,
            code: `export type ${className} = ${localName};`,
        });
    }
};

export { declareFoldedClass, localClassName };
