import { join, resolve } from "node:path";
import * as esbuild from "esbuild";

const projectRoot = resolve(import.meta.dirname, "..");

const nativeShim = `
const { createRequire } = require("node:module");
const { dirname, join } = require("node:path");

const execDir = dirname(process.execPath);
const require2 = createRequire(join(execDir, "package.json"));
module.exports = require2("./gtkx.node");
`;

async function bundle() {
    console.log("Bundling for SEA...");

    await esbuild.build({
        entryPoints: [join(projectRoot, "dist/bundle.js")],
        bundle: true,
        platform: "node",
        target: "node22",
        format: "cjs",
        outfile: join(projectRoot, "dist/bundle.cjs"),
        minify: true,
        banner: {
            js: 'var __import_meta_url = require("url").pathToFileURL(__filename).href;',
        },
        define: {
            "import.meta.url": "__import_meta_url",
        },
        plugins: [
            {
                name: "native-shim",
                setup(build) {
                    build.onResolve({ filter: /\.\/gtkx\.node$/ }, (args) => ({
                        path: args.path,
                        namespace: "native-shim",
                    }));
                    build.onLoad({ filter: /.*/, namespace: "native-shim" }, () => {
                        return { contents: nativeShim, loader: "js" };
                    });
                },
            },
        ],
    });

    console.log("SEA bundle created: dist/bundle.cjs");
}

bundle().catch((err) => {
    console.error("Bundle failed:", err);
    process.exit(1);
});
