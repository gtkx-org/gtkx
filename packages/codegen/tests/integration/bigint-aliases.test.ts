import { describe, expect, it } from "vitest";
import { BUILTIN_BIGINT_ALIASES, bigintAliasCategory, mergeBigIntAliases } from "../../src/bigint-aliases.js";
import { generateNamespaceModule } from "../../src/ffi/pipeline.js";
import type { GirNamespace } from "../../src/gir/namespace.js";
import { generateJsxFiles } from "../../src/react/pipeline.js";
import { repository } from "../helpers/repository.js";

const namespaceNamed = (name: string): GirNamespace => {
    const namespace = repository.namespaces.get(name);
    if (namespace === undefined) {
        throw new Error(`Namespace ${name} is not loaded`);
    }
    return namespace;
};

describe("bigint alias policy", () => {
    it("ships the GStreamer clock-time aliases as built-ins", () => {
        expect(BUILTIN_BIGINT_ALIASES).toEqual(["Gst.ClockTime", "Gst.ClockTimeDiff"]);
    });

    it("merges built-ins with user entries", () => {
        const merged = mergeBigIntAliases(["MyLib.DeviceAddress"]);
        expect([...merged]).toEqual([...BUILTIN_BIGINT_ALIASES, "MyLib.DeviceAddress"]);
    });

    it("derives signedness from the alias target", () => {
        expect(bigintAliasCategory("X.Signed", { kind: "primitive", category: "int64", cType: undefined })).toBe(
            "int64",
        );
        expect(bigintAliasCategory("X.Unsigned", { kind: "primitive", category: "uint64", cType: undefined })).toBe(
            "uint64",
        );
    });

    it("rejects a target that is not a 64-bit integer", () => {
        expect(() =>
            bigintAliasCategory("X.Narrow", { kind: "primitive", category: "uint32", cType: undefined }),
        ).toThrow(/must alias a 64-bit integer GIR type/);
    });
});

describe("bigint alias emission", () => {
    it("emits an allowlisted 64-bit alias as bigint with bigint descriptors at use sites", () => {
        const { source } = generateNamespaceModule(namespaceNamed("GLib"), repository, new Set(["GLib.TimeSpan"]));
        expect(source).toContain("export type TimeSpan = bigint;");
        expect(source).toContain("t.bigint64");
    });

    it("keeps unlisted aliases on their number surface", () => {
        const { source } = generateNamespaceModule(namespaceNamed("GLib"), repository, new Set());
        expect(source).toContain("export type TimeSpan = number;");
        expect(source).not.toContain("t.bigint64");
        expect(source).not.toContain("t.biguint64");
    });

    it("keeps GType numeric while other aliases are allowlisted", () => {
        const { source } = generateNamespaceModule(namespaceNamed("GObject"), repository, new Set(["GLib.TimeSpan"]));
        expect(source).toContain("export type GType = number;");
    });

    it("rejects an allowlisted alias whose target is not 64-bit", () => {
        expect(() => generateNamespaceModule(namespaceNamed("GLib"), repository, new Set(["GLib.Quark"]))).toThrow(
            /"GLib\.Quark" must alias a 64-bit integer GIR type/,
        );
    });

    it("generates the React surface unchanged when allowlisted aliases appear in no props", () => {
        const withAliases = generateJsxFiles(repository, { bigintAliases: new Set(["GLib.TimeSpan"]) });
        const without = generateJsxFiles(repository);
        expect(withAliases.widgetCount).toBe(without.widgetCount);
    });
});
