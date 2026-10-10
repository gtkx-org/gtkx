import { registerHooks } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "tsx/esm/api";
import { workspaceAliases } from "./resolve-workspace-aliases.ts";

register({ tsconfig: fileURLToPath(new URL("../tsconfig.base.json", import.meta.url)) });

registerHooks({
    resolve(specifier, context, nextResolve) {
        const target = workspaceAliases.get(specifier);

        return nextResolve(target === undefined ? specifier : pathToFileURL(target).href, context);
    },
});
