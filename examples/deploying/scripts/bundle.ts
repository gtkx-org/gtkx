import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build, type Plugin } from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = join(__dirname, "..");

const nativeLoaderCode = `
const { createRequire } = require('node:module');
const { dirname, join } = require('node:path');

let nativeModule = null;

function getNativeModule() {
    if (nativeModule) return nativeModule;

    let nativePath;
    let isSea = false;

    try {
        const sea = require('node:sea');
        isSea = sea.isSea();
    } catch {}

    if (isSea) {
        nativePath = join(dirname(process.execPath), 'index.node');
    } else {
        nativePath = require.resolve('@gtkx/native/dist/index.node');
    }

    const nativeRequire = createRequire(nativePath);
    nativeModule = nativeRequire(nativePath);
    return nativeModule;
}

module.exports = getNativeModule();
module.exports.default = module.exports;
`;

const nativePlugin: Plugin = {
    name: "native-loader",
    setup(build) {
        build.onResolve({ filter: /^@gtkx\/native$/ }, () => {
            return {
                path: "@gtkx/native",
                namespace: "native-loader",
            };
        });

        build.onLoad({ filter: /.*/, namespace: "native-loader" }, () => {
            return {
                contents: nativeLoaderCode,
                loader: "js",
            };
        });
    },
};

await build({
    entryPoints: [join(projectRoot, "dist/index.js")],
    bundle: true,
    platform: "node",
    target: "node22",
    format: "cjs",
    outfile: join(projectRoot, "dist/bundle.cjs"),
    plugins: [nativePlugin],
    logLevel: "info",
});

console.log("Bundle created: dist/bundle.cjs");
