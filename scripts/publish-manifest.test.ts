import { describe, expect, it } from "vitest";
import {
    assertPublishedShape,
    collectExportTargets,
    distTagForVersion,
    hasSourceCondition,
    type PackageManifest,
    type PublishedPackage,
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

const strippedReactEntries = [
    "package/README.md",
    "package/package.json",
    "package/dist/index.js",
    "package/dist/index.d.ts",
    "package/dist/internal.js",
    "package/dist/internal.d.ts",
];

const strippedReactManifest = stripDevArtifacts(reactManifest);

const minimalReactTarball: PublishedPackage = {
    name: "@gtkx/react",
    entries: strippedReactEntries,
    manifest: strippedReactManifest,
};

const binEntrypointTarball: PublishedPackage = {
    name: "create-gtkx",
    entries: ["package/README.md", "package/package.json", "package/bin/create-gtkx.js"],
    manifest: { bin: { "create-gtkx": "./bin/create-gtkx.js" }, exports: {} },
};

const reactTarballWithSrc: PublishedPackage = {
    name: "@gtkx/react",
    entries: [...strippedReactEntries, "package/src/index.ts"],
    manifest: strippedReactManifest,
};

const reactTarballWithBuildInfo: PublishedPackage = {
    name: "@gtkx/react",
    entries: [...strippedReactEntries, "package/dist/tsconfig.tsbuildinfo"],
    manifest: strippedReactManifest,
};

const reactTarballWithSourceCondition: PublishedPackage = {
    name: "@gtkx/react",
    entries: strippedReactEntries,
    manifest: reactManifest,
};

const tarballMissingExportTarget: PublishedPackage = {
    name: "@gtkx/react",
    entries: ["package/README.md", "package/package.json", "package/dist/index.js"],
    manifest: { exports: { ".": { default: "./dist/index.js", types: "./dist/index.d.ts" } } },
};

const tarballMissingBinTarget: PublishedPackage = {
    name: "@gtkx/cli",
    entries: ["package/README.md", "package/package.json"],
    manifest: { bin: { gtkx: "./bin/gtkx.js" }, exports: {} },
};

const tarballMissingReadme: PublishedPackage = {
    name: "@gtkx/react",
    entries: ["package/package.json", "package/dist/index.js", "package/dist/index.d.ts"],
    manifest: { exports: {} },
};

const ejsTemplateTarball: PublishedPackage = {
    name: "create-gtkx",
    entries: [
        "package/README.md",
        "package/package.json",
        "package/dist/templates/src/app.tsx.ejs",
        "package/dist/templates/gtkx-env.d.ts.ejs",
    ],
    manifest: { exports: {} },
};

const declarationMapTarball: PublishedPackage = {
    name: "@gtkx/react",
    entries: [...strippedReactEntries, "package/src/index.ts", "package/dist/index.d.ts.map"],
    manifest: strippedReactManifest,
    maps: { "package/dist/index.d.ts.map": sourceMap(["../src/index.ts"]) },
};

const nestedDeclarationMapTarball: PublishedPackage = {
    name: "@gtkx/react",
    entries: [...strippedReactEntries, "package/src/hooks/use-app.ts", "package/dist/hooks/use-app.d.ts.map"],
    manifest: strippedReactManifest,
    maps: { "package/dist/hooks/use-app.d.ts.map": sourceMap(["../../src/hooks/use-app.ts"]) },
};

const tarballMissingMapSource: PublishedPackage = {
    name: "@gtkx/react",
    entries: [...strippedReactEntries, "package/dist/index.d.ts.map"],
    manifest: strippedReactManifest,
    maps: { "package/dist/index.d.ts.map": sourceMap(["../src/index.ts"]) },
};

const inlinedSourcesContentTarball: PublishedPackage = {
    name: "@gtkx/react",
    entries: [...strippedReactEntries, "package/dist/index.js.map"],
    manifest: strippedReactManifest,
    maps: { "package/dist/index.js.map": sourceMap(["../src/index.ts"], ["export {};\n"]) },
};

const malformedMapTarball: PublishedPackage = {
    name: "@gtkx/react",
    entries: [...strippedReactEntries, "package/dist/index.js.map"],
    manifest: strippedReactManifest,
    maps: { "package/dist/index.js.map": "not json" },
};

function sourceMap(sources: string[], sourcesContent?: (string | null)[]): string {
    return JSON.stringify({ version: 3, sources, ...(sourcesContent !== undefined && { sourcesContent }) });
}

describe("stripDevArtifacts", () => {
    it("removes the source condition at every depth", () => {
        const stripped = stripDevArtifacts(reactManifest);
        expect(hasSourceCondition(stripped.exports ?? {})).toBe(false);

        expect(stripped.exports).toEqual({
            "./package.json": "./package.json",
            ".": { types: "./dist/index.d.ts", default: "./dist/index.js" },
            "./internal": { types: "./dist/internal.d.ts", default: "./dist/internal.js" },
        });
    });

    it("keeps src in files so the shipped maps can resolve their sources", () => {
        expect(stripDevArtifacts(reactManifest).files).toEqual(["dist", "src", "!**/*.tsbuildinfo"]);
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

describe("distTagForVersion", () => {
    it("uses the prerelease identifier as the tag", () => {
        expect(distTagForVersion("1.0.0-rc.1")).toBe("rc");
        expect(distTagForVersion("1.0.0-beta.2")).toBe("beta");
        expect(distTagForVersion("2.0.0-alpha")).toBe("alpha");
        expect(distTagForVersion("1.0.0-next.5")).toBe("next");
    });

    it("returns latest for a stable release", () => {
        expect(distTagForVersion("1.0.0")).toBe("latest");
        expect(distTagForVersion("2.3.4")).toBe("latest");
    });

    it("ignores build metadata", () => {
        expect(distTagForVersion("1.0.0+build-abc")).toBe("latest");
        expect(distTagForVersion("1.0.0-rc.1+build.5")).toBe("rc");
    });

    it("falls back to next for a numeric-first prerelease identifier", () => {
        expect(distTagForVersion("1.0.0-0")).toBe("next");
        expect(distTagForVersion("0.0.0-20240714120000")).toBe("next");
    });

    it("returns latest for an empty version", () => {
        expect(distTagForVersion("")).toBe("latest");
    });
});

describe("collectExportTargets", () => {
    it("gathers every relative-path target", () => {
        expect(collectExportTargets(reactManifest.exports ?? {}).toSorted((a, b) => a.localeCompare(b))).toEqual(
            [
                "./dist/index.d.ts",
                "./dist/index.js",
                "./dist/internal.d.ts",
                "./dist/internal.js",
                "./package.json",
                "./src/index.ts",
                "./src/internal.ts",
            ].toSorted((a, b) => a.localeCompare(b)),
        );
    });

    it("ignores non-path condition values", () => {
        expect(collectExportTargets({ ".": { types: "./dist/index.d.ts", node: "some-bare-specifier" } })).toEqual([
            "./dist/index.d.ts",
        ]);
    });
});

describe("assertPublishedShape", () => {
    it("accepts a minimal, self-consistent tarball", () => {
        expect(() => {
            assertPublishedShape(minimalReactTarball);
        }).not.toThrow();
    });

    it("accepts a package whose entrypoints resolve via bin", () => {
        expect(() => {
            assertPublishedShape(binEntrypointTarball);
        }).not.toThrow();
    });

    it("accepts a tarball that ships src", () => {
        expect(() => {
            assertPublishedShape(reactTarballWithSrc);
        }).not.toThrow();
    });

    it("rejects a build artifact", () => {
        expect(() => {
            assertPublishedShape(reactTarballWithBuildInfo);
        }).toThrow(/build artifact/);
    });

    it("rejects a lingering source export condition", () => {
        expect(() => {
            assertPublishedShape(reactTarballWithSourceCondition);
        }).toThrow(/still declares a "source" condition/);
    });

    it("rejects an export target that is not shipped", () => {
        expect(() => {
            assertPublishedShape(tarballMissingExportTarget);
        }).toThrow(/export target \.\/dist\/index\.d\.ts resolves to a missing file/);
    });

    it("rejects a bin target that is not shipped", () => {
        expect(() => {
            assertPublishedShape(tarballMissingBinTarget);
        }).toThrow(/bin target \.\/bin\/gtkx\.js resolves to a missing file/);
    });

    it("rejects a missing README", () => {
        expect(() => {
            assertPublishedShape(tarballMissingReadme);
        }).toThrow(/missing README\.md/);
    });

    it("does not flag ejs templates as TypeScript sources", () => {
        expect(() => {
            assertPublishedShape(ejsTemplateTarball);
        }).not.toThrow();
    });
});

describe("assertPublishedShape source maps", () => {
    it("accepts a declaration map whose source is shipped alongside it", () => {
        expect(() => {
            assertPublishedShape(declarationMapTarball);
        }).not.toThrow();
    });

    it("resolves nested sources relative to the map location", () => {
        expect(() => {
            assertPublishedShape(nestedDeclarationMapTarball);
        }).not.toThrow();
    });

    it("rejects a map whose source is missing from the tarball", () => {
        expect(() => {
            assertPublishedShape(tarballMissingMapSource);
        }).toThrow(/source map dist\/index\.d\.ts\.map references missing source \.\.\/src\/index\.ts/);
    });

    it("accepts a source map that inlines its sourcesContent", () => {
        expect(() => {
            assertPublishedShape(inlinedSourcesContentTarball);
        }).not.toThrow();
    });

    it("rejects a malformed source map", () => {
        expect(() => {
            assertPublishedShape(malformedMapTarball);
        }).toThrow(/source map dist\/index\.js\.map is not valid JSON/);
    });
});
