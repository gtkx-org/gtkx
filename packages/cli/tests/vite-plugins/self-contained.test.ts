import type { Plugin } from "vite";
import { describe, expect, it } from "vitest";
import { gtkxSelfContained } from "../../src/vite-plugins/self-contained.js";

type Output = { type: "asset"; fileName: string } | { type: "chunk"; fileName: string; code: string };
type GenerateBundleHook = (options: Record<string, unknown>, bundle: Record<string, Output>) => void;
type RejectedCase = { title: string; code: string; message: string };
type AcceptedCase = { title: string; code: string };

const BUNDLE_NAME = "bundle.mjs";
const BINDING_NAME = "gtkx.node";
const WORKER_NAME = "workers/counter-4f2a1b3c.mjs";
const ICON_NAME = "icons/hicolor/scalable/apps/com.gtkx.probe.svg";

const NATIVE_LOADER = [
    "import { createRequire as __gtkxCreateRequire } from \"node:module\";",
    "const __gtkxNative = __gtkxCreateRequire(import.meta.url)(\"./gtkx.node\");",
].join("\n");

const MINIFIED_NATIVE_LOADER =
    "import{createRequire as e}from\"node:module\";const{registerClass:t}=e(import.meta.url)(`./gtkx.node`);";

const MANIFEST_HELPER_CALL = "const hostConfig={rendererVersion:qe(import.meta.url,`@gtkx/react/package.json`)};";
const PACKAGE_HELPER_CALL = "const runtime = qe(import.meta.url, \"@gtkx/runtime\");";
const BARE_REQUIRE = "const runtime = require(\"@gtkx/runtime\");";
const OWN_MANIFEST_REQUIRE = "const own = require(\"./package.json\");";

const STORED_REQUIRE = [
    "const load = createRequire(import.meta.url);",
    "const own = load(\"./package.json\");",
].join("\n");

const STORED_META_URL = [
    "const here = import.meta.url;",
    "const manifest = qe(here, \"@gtkx/react/package.json\");",
].join("\n");

const REJECTED_CASES: RejectedCase[] = [
    {
        title: "rejects a gtkx manifest handed to a resolver helper",
        code: MANIFEST_HELPER_CALL,
        message: "bundle.mjs resolves @gtkx/react/package.json at runtime",
    },
    {
        title: "rejects a gtkx package handed to a resolver helper",
        code: PACKAGE_HELPER_CALL,
        message: "@gtkx/runtime",
    },
    {
        title: "rejects a manifest read beside the bundle",
        code: OWN_MANIFEST_REQUIRE,
        message: "bundle.mjs resolves ./package.json at runtime",
    },
    {
        title: "rejects a manifest read through a stored require",
        code: STORED_REQUIRE,
        message: "bundle.mjs resolves ./package.json at runtime",
    },
    {
        title: "rejects a specifier handed a stored import.meta.url",
        code: STORED_META_URL,
        message: "@gtkx/react/package.json",
    },
    {
        title: "rejects a gtkx package required by name",
        code: BARE_REQUIRE,
        message: "@gtkx/runtime",
    },
    {
        title: "rejects a gtkx package imported dynamically",
        code: "const load = () => import(\"@gtkx/components\");",
        message: "@gtkx/components",
    },
    {
        title: "rejects a gtkx package located through resolve",
        code: "const where = require.resolve(\"@gtkx/gl\");",
        message: "@gtkx/gl",
    },
    {
        title: "rejects a package located through import.meta.resolve",
        code: "const where = import.meta.resolve(\"@gtkx/native\");",
        message: "@gtkx/native",
    },
    {
        title: "rejects a dependency the build left external",
        code: "import Database from \"better-sqlite3\";",
        message: "better-sqlite3",
    },
    {
        title: "rejects a module the build never emitted",
        code: "const load = () => import(\"./plugins/extra.js\");",
        message: "./plugins/extra.js",
    },
    {
        title: "names each specifier once and in order",
        code: [BARE_REQUIRE, MANIFEST_HELPER_CALL, "const again = require(\"@gtkx/runtime\");"].join("\n"),
        message: "resolves @gtkx/react/package.json, @gtkx/runtime at runtime",
    },
];

const ACCEPTED_CASES: AcceptedCase[] = [
    {
        title: "accepts the emitted loader for the native binding",
        code: NATIVE_LOADER,
    },
    {
        title: "accepts the minified loader for the native binding",
        code: MINIFIED_NATIVE_LOADER,
    },
    {
        title: "accepts a node builtin required at runtime",
        code: "const fs = require(\"node:fs\");",
    },
    {
        title: "accepts a node builtin required without its prefix",
        code: "const path = require(\"path\");",
    },
    {
        title: "accepts a node builtin imported statically",
        code: "import process from \"node:process\";",
    },
    {
        title: "accepts a chunk the build emits",
        code: `const load = () => import("./${WORKER_NAME}");`,
    },
    {
        title: "accepts an asset URL beside the bundle",
        code: `const icon = new URL("./${ICON_NAME}", import.meta.url);`,
    },
    {
        title: "accepts the output directory URL",
        code: "const here = new URL(\".\", import.meta.url).pathname;",
    },
    {
        title: "accepts a gtkx package name kept as data",
        code: "const hostConfig={rendererPackageName:`@gtkx/react`,rendererVersion:`1.0.0`};",
    },
    {
        title: "accepts prose that mentions a manifest",
        code: "throw new Error(`@gtkx/react has no package.json`)",
    },
    {
        title: "accepts a manifest inlined at build time",
        code: "const manifest = { name: \"@gtkx/react\", exports: { \"./package.json\": \"./package.json\" } };",
    },
];

const generateBundle = (plugin: Plugin): GenerateBundleHook => {
    const hook = plugin.generateBundle;
    const handler = typeof hook === "function" ? hook : hook?.handler;

    if (!handler) {
        throw new TypeError("The self-contained plugin has no generateBundle hook");
    }

    return (options, bundle) => {
        Reflect.apply(handler, {}, [options, bundle]);
    };
};

const chunk = (fileName: string, code: string): Output => ({ type: "chunk", fileName, code });
const asset = (fileName: string): Output => ({ type: "asset", fileName });

const emit = (outputs: Output[], plugin: Plugin = gtkxSelfContained()): void => {
    const bundle: Record<string, Output> = {};

    for (const output of outputs) {
        bundle[output.fileName] = output;
    }

    generateBundle(plugin)({}, bundle);
};

const emitChunk = (code: string): void => {
    emit([chunk(BUNDLE_NAME, code), chunk(WORKER_NAME, ""), asset(BINDING_NAME), asset(ICON_NAME)]);
};

describe("gtkx:self-contained", () => {
    it.each(REJECTED_CASES)("$title", ({ code, message }) => {
        expect(() => {
            emitChunk(code);
        }).toThrow(message);
    });

    it.each(ACCEPTED_CASES)("$title", ({ code }) => {
        expect(() => {
            emitChunk(code);
        }).not.toThrow();
    });

    it("reads a worker specifier from the directory the worker sits in", () => {
        expect(() => {
            emit([chunk(WORKER_NAME, "const native = require(\"../gtkx.node\");"), asset(BINDING_NAME)]);
        }).not.toThrow();

        expect(() => {
            emit([chunk(WORKER_NAME, "const native = require(\"./gtkx.node\");"), asset(BINDING_NAME)]);
        }).toThrow(`${WORKER_NAME} resolves ./gtkx.node at runtime`);
    });

    it("checks every chunk the build emits", () => {
        expect(() => {
            emit([chunk(BUNDLE_NAME, NATIVE_LOADER), chunk(WORKER_NAME, BARE_REQUIRE), asset(BINDING_NAME)]);
        }).toThrow(`${WORKER_NAME} resolves @gtkx/runtime at runtime`);
    });

    it("reaches the same verdict when one plugin instance serves several builds", () => {
        const plugin = gtkxSelfContained();

        const buildClean = (): void => {
            emit([chunk(BUNDLE_NAME, NATIVE_LOADER), asset(BINDING_NAME)], plugin);
        };

        const buildDirty = (): void => {
            emit([chunk(BUNDLE_NAME, MANIFEST_HELPER_CALL), asset(BINDING_NAME)], plugin);
        };

        expect(buildClean).not.toThrow();
        expect(buildDirty).toThrow("@gtkx/react/package.json");
        expect(buildClean).not.toThrow();
        expect(buildDirty).toThrow("@gtkx/react/package.json");
    });

    it("looks at chunks only", () => {
        expect(() => {
            emit([asset(BINDING_NAME)]);
        }).not.toThrow();
    });
});
