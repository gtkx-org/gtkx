import { AST_NODE_TYPES, ESLintUtils, type TSESLint, type TSESTree } from "@typescript-eslint/utils";

type MessageIds = "dollarBrand";
type Context = TSESLint.RuleContext<MessageIds, []>;

type MemberNode =
    | TSESTree.AccessorProperty |
    TSESTree.MethodDefinition |
    TSESTree.PropertyDefinition |
    TSESTree.TSMethodSignature |
    TSESTree.TSPropertySignature;

const brandNaming = ESLintUtils.RuleCreator.withoutDocs<[], MessageIds>({
    meta: {
        type: "suggestion",
        docs: {
            description: "Spell a brand or marker member `__name__` rather than `$name`",
        },
        messages: {
            dollarBrand:
                "`{{name}}` marks a type with a `$` sigil, which nothing else in the generated surface uses. " +
                "Spell it `{{brand}}`, matching `__type__` and `__signals__`.",
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        const member = (node: MemberNode): void => {
            report(context, node);
        };

        return {
            AccessorProperty: member,
            MethodDefinition: member,
            PropertyDefinition: member,
            TSMethodSignature: member,
            TSPropertySignature: member,
        };
    },
});

function memberName(node: MemberNode): string | undefined {
    const { key } = node;

    return node.computed || key.type !== AST_NODE_TYPES.Identifier ? undefined : key.name;
}

function report(context: Context, node: MemberNode): void {
    const name = memberName(node);

    if (!name?.startsWith("$") || name.endsWith("$")) {
        return;
    }

    context.report({ node: node.key, messageId: "dollarBrand", data: { name, brand: `__${name.slice(1)}__` } });
}

export { brandNaming };
