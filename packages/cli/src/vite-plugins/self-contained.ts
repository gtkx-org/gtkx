import type { Plugin } from "vite";

const RESOLUTION_PATTERNS = [
    /(?:require|import)\(\s*(["'`])(@gtkx\/[^"'`\r\n]+)\1\s*\)/g,
    /\.resolve\(\s*(["'`])(@gtkx\/[^"'`\r\n]+)\1/g,
    /(["'`])(@gtkx\/[^"'`\s/]+(?:\/[^"'`\s/]+)*\/package\.json)\1/g,
];

const matchedSpecifiers = (code: string, pattern: RegExp): string[] =>
    code
        .matchAll(pattern)
        .map((match) => match[2])
        .filter((specifier): specifier is string => specifier !== undefined)
        .toArray();

const runtimeGtkxSpecifiers = (code: string): string[] =>
    new Set(RESOLUTION_PATTERNS.flatMap((pattern) => matchedSpecifiers(code, pattern)))
        .values()
        .toArray()
        .toSorted((left, right) => left.localeCompare(right));

const assertSelfContained = (fileName: string, code: string): void => {
    const specifiers = runtimeGtkxSpecifiers(code);

    if (specifiers.length === 0) {
        return;
    }

    throw new Error(
        [
            `${fileName} resolves ${specifiers.join(", ")} at runtime,`,
            "so the built app only starts where a node_modules holding those packages is reachable.",
            "Bundled code must read package data at build time.",
        ].join(" "),
    );
};

function gtkxSelfContained(): Plugin {
    return {
        name: "gtkx:self-contained",
        apply: "build",

        generateBundle(_options, bundle) {
            for (const output of Object.values(bundle)) {
                if (output.type === "chunk") {
                    assertSelfContained(output.fileName, output.code);
                }
            }
        },
    };
}

export { gtkxSelfContained };
