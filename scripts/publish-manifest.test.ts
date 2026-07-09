import { describe, expect, it } from "vitest";
import {
    assertPublishedShape,
    collectExportTargets,
    exportsContainSource,
    type PackageManifest,
    stripDevArtifacts,
} from "./publish-manifest.js";

const reactManifest: PackageManifest = {
    name: "@gtkx/react",
    files: ["dist", "src", "!**/*.tsbuildinfo"],
    exports: {
        "./package.json": "./package.json",
        ".": {
            source: "./src/index.ts",
            types: "./dist/index.d.ts",
            default: "./dist/index.js",
        },
        "./internal": {
            source: "./src/internal.ts",
            types: "./dist/internal.d.ts",
            default: "./dist/internal.js",
        },
    },
};

describe("stripDevArtifacts", () => {
    it("removes the source condition at every depth", () => {
        const stripped = stripDevArtifacts(reactManifest);
        expect(exportsContainSource(stripped.exports ?? {})).toBe(false);
        expect(stripped.exports).toEqual({
            "./package.json": "./package.json",
            ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
            "./internal": { types: "./dist/internal.d.ts", default: "./dist/internal.js" },
        });
    });

    it("removes src from files while keeping other entries", () => {
        expect(stripDevArtifacts(reactManifest).files).toEqual(["dist", "!**/*.tsbuildinfo"]);
    });

    it("leaves condition objects that never declared source untouched", () => {
        const manifest: PackageManifest = {
            files: ["dist", "env.d.ts"],
            exports: { "./env": { types: "./env.d.ts" } },
        };
        const stripped = stripDevArtifacts(manifest);
        expect(stripped.exports).toEqual({ "./env": { types: "./env.d.ts" } });
        expect(stripped.files).toEqual(["dist", "env.d.ts"]);
    });

    it("preserves unrelated manifest fields", () => {
        const manifest: PackageManifest = { name: "@gtkx/x", version: "1.0.0", type: "module" };
        expect(stripDevArtifacts(manifest)).toEqual(manifest);
    });

    it("does not mutate the input manifest", () => {
        const manifest: PackageManifest = { files: ["dist", "src"], exports: { ".": { source: "./src/index.ts" } } };
        stripDevArtifacts(manifest);
        expect(manifest.files).toEqual(["dist", "src"]);
        expect(manifest.exports).toEqual({ ".": { source: "./src/index.ts" } });
    });
});

describe("collectExportTargets", () => {
    it("gathers every relative-path target", () => {
        expect(collectExportTargets(reactManifest.exports ?? {}).sort()).toEqual(
            [
                "./dist/index.d.ts",
                "./dist/index.js",
                "./dist/internal.d.ts",
                "./dist/internal.js",
                "./package.json",
                "./src/index.ts",
                "./src/internal.ts",
            ].sort(),
        );
    });

    it("ignores non-path condition values", () => {
        expect(collectExportTargets({ ".": { types: "./dist/index.d.ts", node: "some-bare-specifier" } })).toEqual([
            "./dist/index.d.ts",
        ]);
    });
});

const strippedReactEntries = [
    "package/README.md",
    "package/package.json",
    "package/dist/index.js",
    "package/dist/index.d.ts",
    "package/dist/internal.js",
    "package/dist/internal.d.ts",
];

const strippedReactManifest = stripDevArtifacts(reactManifest);

describe("assertPublishedShape", () => {
    it("accepts a minimal, self-consistent tarball", () => {
        expect(() =>
            assertPublishedShape({
                name: "@gtkx/react",
                entries: strippedReactEntries,
                manifest: strippedReactManifest,
            }),
        ).not.toThrow();
    });

    it("accepts a package whose entrypoints resolve via bin", () => {
        expect(() =>
            assertPublishedShape({
                name: "create-gtkx",
                entries: ["package/README.md", "package/package.json", "package/bin/create-gtkx.js"],
                manifest: { bin: { "create-gtkx": "./bin/create-gtkx.js" }, exports: {} },
            }),
        ).not.toThrow();
    });

    it("rejects a tarball that ships src", () => {
        expect(() =>
            assertPublishedShape({
                name: "@gtkx/react",
                entries: [...strippedReactEntries, "package/src/index.ts"],
                manifest: strippedReactManifest,
            }),
        ).toThrow(/development source src\/index\.ts/);
    });

    it("rejects a build artifact", () => {
        expect(() =>
            assertPublishedShape({
                name: "@gtkx/react",
                entries: [...strippedReactEntries, "package/dist/tsconfig.tsbuildinfo"],
                manifest: strippedReactManifest,
            }),
        ).toThrow(/build artifact/);
    });

    it("rejects a lingering source export condition", () => {
        expect(() =>
            assertPublishedShape({
                name: "@gtkx/react",
                entries: strippedReactEntries,
                manifest: reactManifest,
            }),
        ).toThrow(/still declares a "source" condition/);
    });

    it("rejects an export target that is not shipped", () => {
        expect(() =>
            assertPublishedShape({
                name: "@gtkx/react",
                entries: ["package/README.md", "package/package.json", "package/dist/index.js"],
                manifest: { exports: { ".": { default: "./dist/index.js", types: "./dist/index.d.ts" } } },
            }),
        ).toThrow(/export target \.\/dist\/index\.d\.ts resolves to a missing file/);
    });

    it("rejects a bin target that is not shipped", () => {
        expect(() =>
            assertPublishedShape({
                name: "@gtkx/cli",
                entries: ["package/README.md", "package/package.json"],
                manifest: { bin: { gtkx: "./bin/gtkx.js" }, exports: {} },
            }),
        ).toThrow(/bin target \.\/bin\/gtkx\.js resolves to a missing file/);
    });

    it("rejects a missing README", () => {
        expect(() =>
            assertPublishedShape({
                name: "@gtkx/react",
                entries: ["package/package.json", "package/dist/index.js", "package/dist/index.d.ts"],
                manifest: { exports: {} },
            }),
        ).toThrow(/missing README\.md/);
    });

    it("does not flag ejs templates as TypeScript sources", () => {
        expect(() =>
            assertPublishedShape({
                name: "create-gtkx",
                entries: [
                    "package/README.md",
                    "package/package.json",
                    "package/dist/templates/src/app.tsx.ejs",
                    "package/dist/templates/gtkx-env.d.ts.ejs",
                ],
                manifest: { exports: {} },
            }),
        ).not.toThrow();
    });
});
