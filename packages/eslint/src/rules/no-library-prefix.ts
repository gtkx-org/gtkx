import { AST_NODE_TYPES, ESLintUtils, TSESLint, type TSESTree } from "@typescript-eslint/utils";
import { getIdentifierName } from "./identifier-name.js";
import { type MemberNode, memberVisitors } from "./member-node.js";

type MessageIds = "glibPrefix" | "gtkPrefix";
type Context = TSESLint.RuleContext<MessageIds, []>;

const BRAND_PREFIX = /^gtkx/i;
const GLIB_PREFIX = /^G[A-Z][a-z]/;
const TOOLKIT_PREFIX = /^gtk(?=$|[A-Z\d_])/i;

const noLibraryPrefix = ESLintUtils.RuleCreator.withoutDocs<[], MessageIds>({
    meta: {
        type: "suggestion",
        docs: {
            description: "Keep the prefixes of the wrapped C libraries off names this workspace declares itself",
        },
        messages: {
            glibPrefix:
                "`{{name}}` carries the GLib `G` prefix, which belongs to the C symbols the bindings wrap, " +
                "not to a name this workspace declares. Call it `{{stripped}}`.",
            gtkPrefix:
                "`{{name}}` carries the GTK `Gtk` prefix, which belongs to the C symbols the bindings wrap, " +
                "not to a name this workspace declares. Name it for what it holds.",
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        const member = (node: MemberNode): void => {
            reportMember(context, node);
        };

        return {
            ...memberVisitors(member),
            // eslint-disable-next-line @typescript-eslint/naming-convention
            "Program:exit": (): void => {
                reportDeclarations(context);
            },
        };
    },
});

function isAmbientDeclaration(context: Context, node: TSESTree.Node): boolean {
    const isAmbientModule = (ancestor: TSESTree.Node): boolean =>
        ancestor.type === AST_NODE_TYPES.TSModuleDeclaration && ancestor.id.type === AST_NODE_TYPES.Literal;

    return context.sourceCode.getAncestors(node).some((ancestor) => isAmbientModule(ancestor));
}

function collectVariable(variable: TSESLint.Scope.Variable, declared: Set<TSESTree.Node>): void {
    for (const definition of variable.defs) {
        if (definition.type !== TSESLint.Scope.DefinitionType.ImportBinding) {
            declared.add(definition.name);
        }
    }
}

function collectScope(scope: TSESLint.Scope.Scope, declared: Set<TSESTree.Node>): void {
    for (const variable of scope.variables) {
        collectVariable(variable, declared);
    }
}

function reportDeclarations(context: Context): void {
    const declared: Set<TSESTree.Node> = new Set();
    const scopes = context.sourceCode.scopeManager?.scopes ?? [];

    for (const scope of scopes) {
        collectScope(scope, declared);
    }

    for (const node of declared) {
        report(context, node, getIdentifierName(node));
    }
}

function reportMember(context: Context, node: MemberNode): void {
    if (node.computed) {
        return;
    }

    report(context, node.key, getIdentifierName(node.key));
}

function report(context: Context, node: TSESTree.Node, name: string | undefined): void {
    if (name === undefined || BRAND_PREFIX.test(name) || isAmbientDeclaration(context, node)) {
        return;
    }

    if (GLIB_PREFIX.test(name)) {
        context.report({ node, messageId: "glibPrefix", data: { name, stripped: name.slice(1) } });
    } else if (TOOLKIT_PREFIX.test(name)) {
        context.report({ node, messageId: "gtkPrefix", data: { name } });
    }
}

export { noLibraryPrefix };
