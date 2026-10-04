import { fileURLToPath } from "node:url";
import tsconfig from "../tsconfig.base.json" with { type: "json" };

const root = new URL("../", import.meta.url);
const workspaceAliases = new Map(Object.entries(tsconfig.compilerOptions.paths).map(([specifier, targets]) => {
    const [target] = targets;

    if (target === undefined) {
        throw new Error(`Missing workspace path for ${specifier}`);
    }

    return [specifier, fileURLToPath(new URL(target, root))];
}));

export { workspaceAliases };
