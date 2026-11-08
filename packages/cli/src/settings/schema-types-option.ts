import type { ESTree } from "vite";
import { warn } from "@gtkx/utils";
import { join } from "node:path";
import { parseSync } from "vite";
import { readSource } from "../internal/source-imports.js";

const OPTION = "allowArbitraryExtensions";
const UPGRADE_GUIDE_URL = "https://gtkx.dev/v2/guide/upgrading-to-2";
const warnedConfigs: Set<string> = new Set();

const propertyName = (key: ESTree.PropertyKey): string | null => {
    if (key.type === "Identifier") {
        return key.name;
    }

    return key.type === "Literal" && typeof key.value === "string" ? key.value : null;
};

const property = (node: ESTree.Expression | undefined, name: string): ESTree.Expression | undefined => {
    if (node?.type !== "ObjectExpression") {
        return undefined;
    }

    const found = node.properties.findLast((entry) => entry.type === "Property" && propertyName(entry.key) === name);

    return found?.type === "Property" ? found.value : undefined;
};

const readTsconfig = (path: string): ESTree.Expression | null => {
    const code = readSource(path);

    if (code === null) {
        return null;
    }

    const { program, errors } = parseSync(path, `(${code}\n)`, { lang: "js", preserveParens: false });
    const [statement] = program.body;

    return errors.length === 0 && statement?.type === "ExpressionStatement" ? statement.expression : null;
};

const isOptionMissing = (config: ESTree.Expression): boolean => {
    const value = property(property(config, "compilerOptions"), OPTION);

    if (value === undefined) {
        return property(config, "extends") === undefined;
    }

    return value.type !== "Literal" || value.value !== true;
};

/**
 * Warns once per tsconfig when the project at `root` has GSettings schemas but its `tsconfig.json` does not enable
 * `allowArbitraryExtensions`, without which TypeScript ignores the declarations generated beside each schema. A
 * tsconfig that inherits its compiler options through `extends`, or that cannot be read, is left alone.
 */
const warnMissingSchemaTypesOption = (root: string): void => {
    const path = join(root, "tsconfig.json");

    if (warnedConfigs.has(path)) {
        return;
    }

    const config = readTsconfig(path);

    if (config === null || !isOptionMissing(config)) {
        return;
    }

    warnedConfigs.add(path);
    warn(
        `GSettings schema imports are typed by declarations beside each schema, which TypeScript only reads with ` +
            `"${OPTION}": true in ${path}. Add it to compilerOptions; see ${UPGRADE_GUIDE_URL}`,
    );
};

export { warnMissingSchemaTypesOption };
