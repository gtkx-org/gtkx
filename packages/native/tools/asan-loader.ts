import { registerHooks } from "node:module";
import { fileURLToPath } from "node:url";

const binary = `native.linux-${process.arch}-gnu.node`;
const binding = fileURLToPath(new URL(`../${binary}`, import.meta.url));
const instrumented = fileURLToPath(new URL(`../build/asan/${binary}`, import.meta.url));

/** Select GTKX's instrumented binding without redirecting other NAPI addons used by the test runner. */
registerHooks({
    resolve(specifier, context, nextResolve) {
        const resolved = nextResolve(specifier, context);

        if (resolved.url.startsWith("file:") && fileURLToPath(resolved.url) === binding) {
            return nextResolve(instrumented, context);
        }

        return resolved;
    },
});
