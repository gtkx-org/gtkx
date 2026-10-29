import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { isMainThread } from "node:worker_threads";
import { fileUrlModule, URL_QUERY_RE } from "./vite-plugins/built-url.js";

const FILE_PROTOCOL = "file:";
const RAW_QUERY_RE = /[?&]raw(?:&|$)/;

const assetModule = (url: string): string | undefined => {
    if (!url.startsWith(FILE_PROTOCOL)) {
        return undefined;
    }

    if (URL_QUERY_RE.test(url)) {
        return fileUrlModule(fileURLToPath(url));
    }

    if (RAW_QUERY_RE.test(url)) {
        return `export default ${JSON.stringify(readFileSync(fileURLToPath(url), "utf8"))};`;
    }

    return undefined;
};

if (!isMainThread) {
    registerHooks({
        load(url, context, nextLoad) {
            const source = assetModule(url);

            return source === undefined ? nextLoad(url, context) : { format: "module", source, shortCircuit: true };
        },
    });
}
