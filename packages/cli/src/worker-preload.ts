import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";
import { isMainThread } from "node:worker_threads";
import { fileUrlModule, URL_QUERY_RE } from "./vite-plugins/built-url.js";

const FILE_PROTOCOL = "file:";

if (!isMainThread) {
    registerHooks({
        load(url, context, nextLoad) {
            if (!url.startsWith(FILE_PROTOCOL) || !URL_QUERY_RE.test(url)) {
                return nextLoad(url, context);
            }

            return { format: "module", source: fileUrlModule(fileURLToPath(url)), shortCircuit: true };
        },
    });
}
