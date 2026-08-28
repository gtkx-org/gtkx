import { sourceStringLiteral } from "@gtkx/utils";
import type { ModuleContext } from "../../writer/context.js";
import { indent } from "../../writer/emit.js";

type FoldedClassOptions = {
    context: ModuleContext;
    className: string;
    doc: string;
    owner: string;
    localDeclaration: string;
    registrations: string[];
    hasInstanceInterface: boolean;
};

const localClassName = (className: string): string => `_${className}`;

const renderNameStatement = (className: string): string =>
    `globalThis.Object.defineProperty(${localClassName(className)}, "name", ` +
    `{ value: ${sourceStringLiteral(className)}, configurable: true });`;

const declareFoldedClass = (options: FoldedClassOptions): void => {
    const { context, className, doc, owner, localDeclaration, registrations, hasInstanceInterface } = options;
    const localName = localClassName(className);
    context.module.appendDeclaration({ name: localName, code: localDeclaration, isLocal: true });

    const body = [renderNameStatement(className), ...registrations, `return ${localName};`]
        .map((statement) => indent(statement, 1))
        .join("\n");

    if (!hasInstanceInterface) {
        context.declare({
            name: className,
            code: `${doc}export const ${className}: typeof ${localName} = /* @__PURE__ */ (() => {\n${body}\n})();`,
            owner,
        });

        return;
    }

    context.declare({
        name: className,
        code: `export interface ${className} extends ${localName} {}`,
    });

    context.addRuntimeTypeImport("WrapperClass");
    const constType = `WrapperClass<typeof ${localName}, ${className}>`;

    context.declare({
        name: className,
        code:
            `${doc}export const ${className}: ${constType} = ` +
            `/* @__PURE__ */ (() => {\n${body}\n})() as ${constType};`,
        owner,
    });
};

export { declareFoldedClass, localClassName };
