import { ESLintUtils, type TSESLint } from "@typescript-eslint/utils";

type Options = [{ entrypoints: string[] }];
type MessageIds = "missingEntrypoint" | "privatePackage";
type Context = TSESLint.RuleContext<MessageIds, Options>;
type JsonLocation = { start: { line: number; column: number }; end: { line: number; column: number } };

type JsonNode = {
    loc: JsonLocation;
    key?: { value?: string; name?: string };
    value?: JsonNode & { value?: unknown };
    properties?: JsonNode[];
};

const MANIFEST_SELECTOR = "Program > JSONExpressionStatement > JSONObjectExpression";

const publicEntrypoints = ESLintUtils.RuleCreator.withoutDocs<Options, MessageIds>({
    meta: {
        type: "problem",
        docs: {
            description: "Require every entrypoint listed in api.json to resolve to a published export subpath",
        },
        messages: {
            missingEntrypoint:
                "`{{specifier}}` is listed in api.json but this package exports no `{{subpath}}` subpath. " +
                "Drop the entry or add the export.",
            privatePackage:
                "`{{specifier}}` is listed in api.json but this package is private, so it never ships. " +
                "Drop the entry or publish the package.",
        },
        schema: [
            {
                type: "object",
                properties: { entrypoints: { type: "array", items: { type: "string" } } },
                required: ["entrypoints"],
                additionalProperties: false,
            },
        ],
    },
    defaultOptions: [{ entrypoints: [] }],
    create(context, [options]) {
        return Object.fromEntries([
            [MANIFEST_SELECTOR, (node: JsonNode): void => {
                inspectManifest(context, node, options.entrypoints);
            }],
        ]);
    },
});

const getPropertyName = (node: JsonNode): string | undefined => node.key?.value ?? node.key?.name;

const propertyFor = (object: JsonNode | undefined, name: string): JsonNode | undefined =>
    object?.properties?.find((property) => getPropertyName(property) === name);

const getLiteralValue = (node: JsonNode | undefined): unknown => node?.value?.value;

const subpathFor = (specifier: string, name: string): string =>
    specifier === name ? "." : `.${specifier.slice(name.length)}`;

const isOwnedBy = (specifier: string, name: string): boolean =>
    specifier === name || specifier.startsWith(`${name}/`);

const reportEntrypoint = (context: Context, node: JsonNode, specifier: string, name: string): void => {
    const subpath = subpathFor(specifier, name);
    const exported = propertyFor(node, "exports")?.value;

    if (getLiteralValue(propertyFor(node, "private")) === true) {
        context.report({ loc: node.loc, messageId: "privatePackage", data: { specifier } });

        return;
    }

    if (propertyFor(exported, subpath) === undefined) {
        context.report({
            loc: (exported ?? node).loc,
            messageId: "missingEntrypoint",
            data: { specifier, subpath },
        });
    }
};

const inspectManifest = (context: Context, node: JsonNode, entrypoints: string[]): void => {
    const name = getLiteralValue(propertyFor(node, "name"));

    if (typeof name !== "string") {
        return;
    }

    const owned = entrypoints.filter((entry) => isOwnedBy(entry, name));

    for (const specifier of owned) {
        reportEntrypoint(context, node, specifier, name);
    }
};

export { publicEntrypoints };
