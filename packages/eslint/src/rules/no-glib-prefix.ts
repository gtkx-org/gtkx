import { AST_NODE_TYPES, ESLintUtils, type TSESLint, type TSESTree } from "@typescript-eslint/utils";
import { getIdentifierName } from "./identifier-name.js";

type MessageIds = "glibPrefix";
type Context = TSESLint.RuleContext<MessageIds, []>;

type NamedDeclaration =
    | TSESTree.ClassDeclaration |
    TSESTree.FunctionDeclaration |
    TSESTree.TSEnumDeclaration |
    TSESTree.TSInterfaceDeclaration |
    TSESTree.TSTypeAliasDeclaration;

const GLIB_PREFIX = /^G[A-Z][a-z]/;

const noGlibPrefix = ESLintUtils.RuleCreator.withoutDocs<[], MessageIds>({
    meta: {
        type: "suggestion",
        docs: {
            description: "Keep the GLib `G` prefix off names this workspace declares itself",
        },
        messages: {
            glibPrefix:
                "`{{name}}` carries the GLib `G` prefix, which belongs to the C symbols the bindings wrap, " +
                "not to a name this workspace declares. Call it `{{stripped}}`.",
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        const named = (node: NamedDeclaration): void => {
            report(context, node, getIdentifierName(node.id));
        };

        return {
            ClassDeclaration: named,
            FunctionDeclaration: named,
            TSEnumDeclaration: named,
            TSInterfaceDeclaration: named,
            TSTypeAliasDeclaration: named,
            VariableDeclarator: (node): void => {
                if (node.id.type === AST_NODE_TYPES.Identifier) {
                    report(context, node.id, node.id.name);
                }
            },
        };
    },
});

function report(context: Context, node: TSESTree.Node, name: string | undefined): void {
    if (name === undefined || !GLIB_PREFIX.test(name)) {
        return;
    }

    context.report({ node, messageId: "glibPrefix", data: { name, stripped: name.slice(1) } });
}

export { noGlibPrefix };
