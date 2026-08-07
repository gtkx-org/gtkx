import { AST_NODE_TYPES, ESLintUtils, type TSESLint, type TSESTree } from "@typescript-eslint/utils";
import ts from "typescript";
import {
    getDeclarationKey,
    isGovernedFile,
    publicSurfaceFor,
    type Surface,
    type SurfaceOptions,
} from "./public-surface.js";

type Options = [SurfaceOptions];
type MessageIds = "missingJsDoc" | "privateJsDoc";
type Context = TSESLint.RuleContext<MessageIds, Options>;

type Subject = {
    doc: ts.JSDoc | undefined;
    isPublic: boolean;
    name: string;
    node: ts.Node;
};

const DOCUMENTABLE = [
    AST_NODE_TYPES.ClassDeclaration,
    AST_NODE_TYPES.FunctionDeclaration,
    AST_NODE_TYPES.MethodDefinition,
    AST_NODE_TYPES.PropertyDefinition,
    AST_NODE_TYPES.TSDeclareFunction,
    AST_NODE_TYPES.TSEnumDeclaration,
    AST_NODE_TYPES.TSIndexSignature,
    AST_NODE_TYPES.TSInterfaceDeclaration,
    AST_NODE_TYPES.TSMethodSignature,
    AST_NODE_TYPES.TSPropertySignature,
    AST_NODE_TYPES.TSTypeAliasDeclaration,
    AST_NODE_TYPES.VariableDeclaration,
];

const publicApiJsdoc = ESLintUtils.RuleCreator.withoutDocs<Options, MessageIds>({
    meta: {
        type: "suggestion",
        docs: {
            description:
                "Require JSDoc on every declaration reachable from a public entrypoint, and forbid it everywhere else",
        },
        messages: {
            missingJsDoc: "`{{name}}` is reachable from a public entrypoint, so it needs a JSDoc block describing it.",
            privateJsDoc:
                "`{{name}}` is not reachable from a public entrypoint, so it must not carry JSDoc. " +
                "Clarify it through naming and structure instead.",
        },
        schema: [
            {
                type: "object",
                properties: {
                    entrypoints: { type: "array", items: { type: "string" } },
                    modules: { type: "array", items: { type: "string" } },
                    root: { type: "string" },
                },
                required: ["entrypoints", "modules", "root"],
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [{ entrypoints: [], modules: [], root: "" }],
    create(context, [options]) {
        const services = ESLintUtils.getParserServices(context);
        const surface = publicSurfaceFor(options);

        if (!isGovernedFile(surface, context.filename)) {
            return {};
        }

        const visit = (node: TSESTree.Node): void => {
            const target = services.esTreeNodeToTSNodeMap.get(node);
            report(context, node, describe(surface, target));
        };

        return Object.fromEntries(DOCUMENTABLE.map((type) => [type, guard(visit, services)]));
    },
});

const getJsDocComment = (node: ts.Node): ts.JSDoc | undefined => {
    const docs = (node as { jsDoc?: ts.JSDoc[] }).jsDoc;

    return docs === undefined ? undefined : docs.at(-1);
};

const getDocumentedNode = (node: ts.Node): ts.Node => (ts.isVariableDeclaration(node) ? node.parent.parent : node);

const getDeclaredName = (node: ts.Node): string => {
    const named = node as { name?: ts.Node };

    if (named.name !== undefined) {
        return named.name.getText();
    }

    const first = ts.isVariableStatement(node) ? node.declarationList.declarations[0] : undefined;

    return first === undefined ? "this" : first.name.getText();
};

const isOverloadFollower = (node: ts.Node): boolean => {
    const siblings: ts.Node[] = (node as { symbol?: ts.Symbol }).symbol?.declarations ?? [];

    return siblings.length > 1 && siblings.at(0) !== node;
};

const isSurfaceMember = (surface: Surface, node: ts.Node): boolean => {
    if (surface.keys.has(getDeclarationKey(node))) {
        return true;
    }

    const declarations = ts.isVariableStatement(node) ? node.declarationList.declarations : [];

    return declarations.some((entry) => surface.keys.has(getDeclarationKey(entry)));
};

const describe = (surface: Surface, node: ts.Node): Subject => {
    const target = getDocumentedNode(node);

    return {
        doc: getJsDocComment(target),
        isPublic: isSurfaceMember(surface, target),
        name: getDeclaredName(target),
        node: target,
    };
};

const report = (context: Context, node: TSESTree.Node, subject: Subject): void => {
    const data = { name: subject.name };

    if (subject.doc === undefined && subject.isPublic && !isOverloadFollower(subject.node)) {
        context.report({ node, messageId: "missingJsDoc", data });
    }

    if (subject.doc !== undefined && !subject.isPublic) {
        context.report({ node, messageId: "privateJsDoc", data });
    }
};

const guard =
    (visit: (node: TSESTree.Node) => void, services: ReturnType<typeof ESLintUtils.getParserServices>) =>
        (node: TSESTree.Node): void => {
            if (services.esTreeNodeToTSNodeMap.has(node)) {
                visit(node);
            }
        };

export { publicApiJsdoc };
