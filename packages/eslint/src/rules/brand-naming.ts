import { ESLintUtils, type TSESLint } from "@typescript-eslint/utils";
import { getIdentifierName } from "./identifier-name.js";
import { type MemberNode, memberVisitors } from "./member-node.js";

type MessageIds = "dollarBrand";
type Context = TSESLint.RuleContext<MessageIds, []>;

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

        return memberVisitors(member);
    },
});

function report(context: Context, node: MemberNode): void {
    if (node.computed) {
        return;
    }

    const name = getIdentifierName(node.key);

    if (!name?.startsWith("$") || name.endsWith("$")) {
        return;
    }

    context.report({ node: node.key, messageId: "dollarBrand", data: { name, brand: `__${name.slice(1)}__` } });
}

export { brandNaming };
