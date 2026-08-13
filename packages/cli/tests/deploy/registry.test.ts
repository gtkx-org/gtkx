import { describe, expect, it } from "vitest";
import type { DeployTarget } from "../../src/deploy/types.js";
import { DEFAULT_TARGETS, KNOWN_NAMES, parseTargetList, targetsFor } from "../../src/deploy/registry.js";

const ALL_NAMES = ["appimage", "deb", "flatpak", "rpm"];

const namesFor = (targets: DeployTarget[]): string[] => targets.map((target) => target.name);

describe("KNOWN_NAMES and DEFAULT_TARGETS", () => {
    it("defaults to flatpak alone", () => {
        expect(DEFAULT_TARGETS).toEqual(["flatpak"]);
    });

    it("lists every known target in alphabetical order", () => {
        expect(KNOWN_NAMES).toBe("appimage, deb, flatpak, rpm");
    });
});

describe("targetsFor ordering", () => {
    it("returns the requested targets in canonical order", () => {
        expect(namesFor(targetsFor(["rpm", "deb"]))).toEqual(["deb", "rpm"]);
    });

    it("ignores the order the names arrive in", () => {
        expect(namesFor(targetsFor(["rpm", "appimage", "flatpak", "deb"]))).toEqual(ALL_NAMES);
    });

    it("returns a single target unchanged", () => {
        expect(namesFor(targetsFor(["flatpak"]))).toEqual(["flatpak"]);
    });

    it("resolves each name to the target that carries it", () => {
        expect(targetsFor(["appimage"])[0]?.name).toBe("appimage");
    });
});

describe("targetsFor deduplication", () => {
    it("collapses a repeated name to one target", () => {
        expect(namesFor(targetsFor(["deb", "deb"]))).toEqual(["deb"]);
    });

    it("collapses names that differ only by surrounding whitespace", () => {
        expect(namesFor(targetsFor([" rpm", "rpm "]))).toEqual(["rpm"]);
    });

    it("trims a padded name before looking it up", () => {
        expect(namesFor(targetsFor(["  flatpak  "]))).toEqual(["flatpak"]);
    });

    it("keeps distinct names while collapsing the duplicates among them", () => {
        expect(namesFor(targetsFor(["rpm", "deb", "rpm", "deb"]))).toEqual(["deb", "rpm"]);
    });
});

describe("targetsFor rejection", () => {
    it("names the unknown target", () => {
        expect(() => targetsFor(["snap"])).toThrow("Unknown deploy target \"snap\"");
    });

    it("lists the known targets alongside the unknown one", () => {
        expect(() => targetsFor(["snap"])).toThrow(KNOWN_NAMES);
    });

    it("rejects an unknown name even when a known one comes first", () => {
        expect(() => targetsFor(["deb", "msi"])).toThrow("Unknown deploy target \"msi\"");
    });

    it("rejects a name that differs only by case", () => {
        expect(() => targetsFor(["Deb"])).toThrow("Unknown deploy target \"Deb\"");
    });

    it("rejects an empty string as a target name", () => {
        expect(() => targetsFor([""])).toThrow("Unknown deploy target");
    });

    it("rejects an inherited object property as a target name", () => {
        expect(() => targetsFor(["toString"])).toThrow("Unknown deploy target \"toString\"");
    });

    it("refuses to deploy without a target", () => {
        expect(() => targetsFor([])).toThrow("Cannot deploy without a target");
    });

    it("lists the known targets when there is nothing to deploy", () => {
        expect(() => targetsFor([])).toThrow(KNOWN_NAMES);
    });
});

describe("parseTargetList", () => {
    it("splits a comma-separated string", () => {
        expect(parseTargetList("deb,rpm")).toEqual(["deb", "rpm"]);
    });

    it("trims the whitespace around each segment", () => {
        expect(parseTargetList(" deb , rpm ")).toEqual(["deb", "rpm"]);
    });

    it("drops empty segments", () => {
        expect(parseTargetList("deb,,rpm,")).toEqual(["deb", "rpm"]);
    });

    it("drops segments that hold only whitespace", () => {
        expect(parseTargetList("deb,   ,rpm")).toEqual(["deb", "rpm"]);
    });

    it("returns an empty list for an empty string", () => {
        expect(parseTargetList("")).toEqual([]);
    });

    it("returns an empty list for a string of separators", () => {
        expect(parseTargetList(", ,")).toEqual([]);
    });

    it("returns a single name when there is no separator", () => {
        expect(parseTargetList("flatpak")).toEqual(["flatpak"]);
    });

    it("keeps unknown names for the caller to reject", () => {
        expect(parseTargetList("snap")).toEqual(["snap"]);
    });

    it("feeds targetsFor directly", () => {
        const parsed = parseTargetList("rpm, deb");
        expect(namesFor(targetsFor(parsed))).toEqual(["deb", "rpm"]);
    });
});

describe("every registered target", () => {
    const targets = targetsFor(ALL_NAMES);

    it("carries a non-empty name", () => {
        expect(targets.every((target) => target.name.length > 0)).toBe(true);
    });

    it("carries a prefix rooted at the filesystem root", () => {
        expect(targets.every((target) => target.prefix.startsWith("/"))).toBe(true);
    });

    it("carries a render function", () => {
        expect(targets.every((target) => typeof target.render === "function")).toBe(true);
    });

    it("carries a pack function", () => {
        expect(targets.every((target) => typeof target.pack === "function")).toBe(true);
    });

    it("carries a list of tools", () => {
        expect(targets.every((target) => Array.isArray(target.tools))).toBe(true);
    });
});
