import { AST_NODE_TYPES, ESLintUtils, type TSESLint, type TSESTree } from "@typescript-eslint/utils";
import { CONTIGUOUS, sectionOf } from "./sections.js";

type MessageIds = "missingPadding" | "unexpectedPadding" | "extraPadding";
type SourceCode = TSESLint.SourceCode;
type Anchor = TSESTree.Node | TSESTree.Comment;

type Pair = {
    previous: TSESTree.Node;
    next: TSESTree.Node;
    anchor: Anchor;
    blankLines: number;
    boundary: boolean;
    contiguous: boolean;
};

type Violation = {
    messageId: MessageIds;
    data: Record<string, string | number>;
};

const statementPadding = ESLintUtils.RuleCreator.withoutDocs<[], MessageIds>({
    meta: {
        type: "layout",
        fixable: "whitespace",
        docs: {
            description:
                "Separate module sections, multiline statements and return statements with one blank line, and keep adjacent single-line statements together",
        },
        messages: {
            missingPadding: "Expected a blank line before this {{reason}}.",
            unexpectedPadding: "Unexpected blank line here; keep these statements together.",
            extraPadding: "Expected exactly one blank line here, found {{count}}.",
        },
        schema: [],
    },
    defaultOptions: [],
    create(context) {
        const check = (statements: TSESTree.Node[], sectioned: boolean): void => {
            for (const pair of pairsOf(statements, context.sourceCode, sectioned)) {
                report(context, pair);
            }
        };

        return {
            Program: (node): void => {
                check(node.body, true);
            },
            BlockStatement: (node): void => {
                check(node.body, false);
            },
            StaticBlock: (node): void => {
                check(node.body, false);
            },
            SwitchCase: (node): void => {
                check(node.consequent, false);
            },
            TSModuleBlock: (node): void => {
                check(node.body, false);
            },
        };
    },
});

const isMultiline = (node: TSESTree.Node): boolean => node.loc.start.line !== node.loc.end.line;
const isEmpty = (node: TSESTree.Node): boolean => node.type === AST_NODE_TYPES.EmptyStatement;
const isReturn = (node: TSESTree.Node): boolean => node.type === AST_NODE_TYPES.ReturnStatement;
const isPadded = (node: TSESTree.Node): boolean => isMultiline(node) || isReturn(node);

const anchorOf = (node: TSESTree.Node, previous: TSESTree.Node, source: SourceCode): Anchor => {
    const leading = source.getCommentsBefore(node).find((comment) => comment.loc.start.line > previous.loc.end.line);

    return leading ?? node;
};

const pairOf = (previous: TSESTree.Node, next: TSESTree.Node, source: SourceCode, sectioned: boolean): Pair => {
    const anchor = anchorOf(next, previous, source);
    const previousSection = sectionOf(previous);
    const nextSection = sectionOf(next);
    const sameSection = previousSection === nextSection;
    const known = previousSection !== undefined && nextSection !== undefined;

    return {
        previous,
        next,
        anchor,
        blankLines: anchor.loc.start.line - previous.loc.end.line - 1,
        boundary: sectioned && known && !sameSection,
        contiguous: sectioned && sameSection && previousSection !== undefined && CONTIGUOUS.has(previousSection),
    };
};

const pairsOf = (statements: TSESTree.Node[], source: SourceCode, sectioned: boolean): Pair[] => {
    const pairs: Pair[] = [];

    for (const [index, next] of statements.entries()) {
        const previous = statements[index - 1];
        if (previous === undefined || isEmpty(previous) || isEmpty(next)) continue;
        pairs.push(pairOf(previous, next, source, sectioned));
    }

    return pairs;
};

const padWith = (
    source: SourceCode,
    previous: TSESTree.Node,
    anchor: Anchor,
    newlines: number,
): TSESLint.ReportFixFunction =>
    (fixer) => {
        const between = source.getText().slice(previous.range[1], anchor.range[0]);
        const indent = between.slice(between.lastIndexOf("\n") + 1);

        return fixer.replaceTextRange([previous.range[1], anchor.range[0]], "\n".repeat(newlines) + indent);
    };

const needsPadding = (pair: Pair): boolean =>
    !pair.contiguous && (pair.boundary || isPadded(pair.previous) || isPadded(pair.next));

const reasonOf = (pair: Pair): string => {
    if (pair.boundary) return `${String(sectionOf(pair.next))} section`;
    if (isReturn(pair.next) || isReturn(pair.previous)) return "return statement";

    return "multiline statement";
};

const violationOf = (pair: Pair, wants: number): Violation => {
    if (wants === 0) return { messageId: "unexpectedPadding", data: {} };
    if (pair.blankLines === 0) return { messageId: "missingPadding", data: { reason: reasonOf(pair) } };

    return { messageId: "extraPadding", data: { count: pair.blankLines } };
};

const report = (context: TSESLint.RuleContext<MessageIds, []>, pair: Pair): void => {
    const { previous, next, anchor, blankLines } = pair;
    if (anchor.loc.start.line <= previous.loc.end.line) return;
    const wants = needsPadding(pair) ? 1 : 0;
    if (blankLines === wants) return;
    const loc = context.sourceCode.getFirstToken(next)?.loc ?? next.loc;
    const violation = violationOf(pair, wants);

    context.report({
        loc,
        messageId: violation.messageId,
        data: violation.data,
        fix: padWith(context.sourceCode, previous, anchor, wants + 1),
    });
};

export { statementPadding };
