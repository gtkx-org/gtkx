import { AST_NODE_TYPES, ESLintUtils, type TSESTree } from "@typescript-eslint/utils";

type MessageIds = "inlineExport";
type Declaration = NonNullable<TSESTree.ExportNamedDeclaration["declaration"]>;
type InlineExport = TSESTree.ExportNamedDeclaration & { declaration: Declaration };

const noInlineExports = ESLintUtils.RuleCreator.withoutDocs<[], MessageIds>({
    meta: {
        type: "suggestion",
        docs: {
            description: "Require a module's public surface to be declared in a trailing export list",
        },
        messages: {
            inlineExport:
                "Declare {{names}} without `export` and add {{list}} to the trailing export list, " +
                "so the module's public surface reads in one place.",
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        return {
            Program(program): void {
                for (const node of inlineExportsIn(program)) {
                    context.report({
                        loc: context.sourceCode.getFirstToken(node)?.loc ?? node.loc,
                        messageId: "inlineExport",
                        data: getData(getNames(node.declaration)),
                    });
                }
            },
        };
    },
});

const isInlineExport = (statement: TSESTree.ProgramStatement): statement is InlineExport =>
    statement.type === AST_NODE_TYPES.ExportNamedDeclaration && statement.declaration !== null;

const inlineExportsIn = (program: TSESTree.Program): InlineExport[] => program.body.filter(isInlineExport);

const identifierName = (node: TSESTree.Node): string | undefined =>
    node.type === AST_NODE_TYPES.Identifier ? node.name : undefined;

const variableNames = (declaration: TSESTree.VariableDeclaration): string[] =>
    declaration.declarations.map((entry) => identifierName(entry.id)).filter((name) => name !== undefined);

const namedDeclarationName = (declaration: Exclude<Declaration, TSESTree.VariableDeclaration>): string | undefined => {
    const id: TSESTree.Node | null = declaration.id;

    return id === null ? undefined : identifierName(id);
};

const getNames = (declaration: Declaration): string[] => {
    if (declaration.type === AST_NODE_TYPES.VariableDeclaration) {
        return variableNames(declaration);
    }

    const name = namedDeclarationName(declaration);

    return name === undefined ? [] : [name];
};

const getData = (names: string[]): Record<string, string> =>
    names.length === 0
        ? { names: "this", list: "it" }
        : { names: names.join(", "), list: `\`export { ${names.join(", ")} };\`` };

export { noInlineExports };
