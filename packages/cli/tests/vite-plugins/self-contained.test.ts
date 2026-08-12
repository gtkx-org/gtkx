import type { Plugin } from "vite";
import { describe, expect, it } from "vitest";
import { gtkxSelfContained } from "../../src/vite-plugins/self-contained.js";

type Output = { type: "asset"; fileName: string } | { type: "chunk"; fileName: string; code: string };
type GenerateBundleHook = (options: Record<string, unknown>, bundle: Record<string, Output>) => void;
type RejectedCase = { title: string; code: string; message: string };
type AcceptedCase = { title: string; code: string };

const BUNDLE_NAME = "bundle.js";
const MANIFEST_HELPER_CALL = "rendererVersion:qe(import.meta.url,`@gtkx/react/package.json`)";
const BARE_REQUIRE = "const runtime = require(\"@gtkx/runtime\");";

const REJECTED_CASES: RejectedCase[] = [
    {
        title: "rejects a gtkx manifest handed to a resolver helper",
        code: MANIFEST_HELPER_CALL,
        message: "bundle.js resolves @gtkx/react/package.json at runtime",
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
        title: "names each specifier once and in order",
        code: [BARE_REQUIRE, MANIFEST_HELPER_CALL, BARE_REQUIRE].join("\n"),
        message: "resolves @gtkx/react/package.json, @gtkx/runtime at runtime",
    },
];

const ACCEPTED_CASES: AcceptedCase[] = [
    {
        title: "accepts the emitted loader for the native binding",
        code: "const native = __gtkxCreateRequire(import.meta.url)(\"./gtkx.node\");",
    },
    {
        title: "accepts a gtkx package name kept as data",
        code: "rendererPackageName:`@gtkx/react`,rendererVersion:`1.0.0`",
    },
    {
        title: "accepts a node builtin required at runtime",
        code: "const fs = require(\"node:fs\");",
    },
    {
        title: "accepts a manifest read beside the bundle",
        code: "const own = require(\"./package.json\");",
    },
    {
        title: "accepts prose that mentions a manifest",
        code: "throw new Error(`@gtkx/react has no package.json`)",
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

const emit = (output: Output): void => {
    generateBundle(gtkxSelfContained())({}, { [output.fileName]: output });
};

const emitChunk = (code: string): void => {
    emit({ type: "chunk", fileName: BUNDLE_NAME, code });
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

    it("looks at chunks only", () => {
        expect(() => {
            emit({ type: "asset", fileName: "gtkx.node" });
        }).not.toThrow();
    });
});
