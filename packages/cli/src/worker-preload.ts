import { readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { isMainThread } from "node:worker_threads";
import { lookup } from "mrmime";
import { openWorkerSources } from "./internal/worker-sources.js";
import { fileUrlModule, URL_QUERY_RE } from "./vite-plugins/built-url.js";

const FILE_PROTOCOL = "file:";
const RAW_QUERY_RE = /[?&]raw(?:&|$)/;
const INLINE_QUERY_RE = /[?&]inline(?:&|$)/;

const inlineValue = (path: string): string =>
    path.endsWith(".css")
        ? readFileSync(path, "utf8")
        : `data:${lookup(path) ?? "application/octet-stream"};base64,${readFileSync(path).toString("base64")}`;

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

    if (INLINE_QUERY_RE.test(url)) {
        return `export default ${JSON.stringify(inlineValue(fileURLToPath(url)))};`;
    }

    return undefined;
};

if (!isMainThread) {
    const sources = openWorkerSources();

    registerHooks({
        load(url, context, nextLoad) {
            if (url.startsWith(FILE_PROTOCOL)) {
                sources.postMessage(fileURLToPath(url));
            }

            const source = assetModule(url);

            return source === undefined ? nextLoad(url, context) : { format: "module", source, shortCircuit: true };
        },
    });
}
