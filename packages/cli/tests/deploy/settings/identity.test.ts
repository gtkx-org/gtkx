import { describe, expect, it } from "vitest";
import type { PackageManifest } from "../../../src/deploy/settings/package-manifest.js";
import {
    type IdentityRequest,
    normalizePackageName,
    resolveBinaryName,
    resolveDescription,
    resolveDeveloper,
    resolveLicense,
    resolveName,
    resolveSummary,
    resolveVersionString,
} from "../../../src/deploy/settings/identity.js";

const EMPTY_MANIFEST: PackageManifest = {
    name: null,
    version: null,
    description: null,
    license: null,
    homepage: null,
    author: { name: null, email: null },
};

const request = (overrides: Partial<IdentityRequest>): IdentityRequest => ({
    applicationId: "com.gtkx.tutorial",
    deploy: {},
    manifest: EMPTY_MANIFEST,
    ...overrides,
});

const withManifest = (manifest: Partial<PackageManifest>): IdentityRequest =>
    request({ manifest: { ...EMPTY_MANIFEST, ...manifest } });

describe("normalizePackageName", () => {
    it("strips the scope, lowercases, and collapses separators", () => {
        expect(normalizePackageName("@acme/My_App")).toBe("my-app");
    });

    it("drops leading and trailing separators", () => {
        expect(normalizePackageName("--Weird.Name--")).toBe("weird-name");
    });
});

describe("resolveBinaryName", () => {
    it("prefers the configured binary name", () => {
        expect(resolveBinaryName(request({ deploy: { binaryName: "gtkx-tutorial" } }))).toBe("gtkx-tutorial");
    });

    it("falls back to the package name", () => {
        expect(resolveBinaryName(withManifest({ name: "@gtkx/Tasks" }))).toBe("tasks");
    });

    it("falls back to the last application id segment", () => {
        expect(resolveBinaryName(request({}))).toBe("tutorial");
    });

    it("rejects a name that cannot be a package name", () => {
        expect(() => resolveBinaryName(request({ deploy: { binaryName: "#" } }))).toThrow("deploy.binaryName");
    });
});

describe("resolveName", () => {
    it("title-cases the package name", () => {
        expect(resolveName(withManifest({ name: "@gtkx/my-tasks" }))).toBe("My Tasks");
    });

    it("title-cases the last application id segment when there is no package name", () => {
        expect(resolveName(request({}))).toBe("Tutorial");
    });
});

describe("resolveSummary and resolveDescription", () => {
    it("takes the first line of the package description", () => {
        expect(resolveSummary(withManifest({ description: "One line\nsecond line" }))).toBe("One line");
    });

    it("defaults the description to the summary", () => {
        expect(resolveDescription(request({ deploy: { summary: "A summary" } }))).toEqual(["A summary"]);
    });

    it("names both sources when no summary can be found", () => {
        expect(() => resolveSummary(request({}))).toThrow(/deploy\.summary.*description/s);
    });
});

describe("resolveDeveloper", () => {
    it("parses the package author string", () => {
        const developer = resolveDeveloper(withManifest({ author: { name: "GTKX", email: "hello@gtkx.dev" } }));
        expect(developer).toEqual({ id: "com.gtkx", name: "GTKX", email: "hello@gtkx.dev" });
    });

    it("derives the developer id from the application id", () => {
        expect(resolveDeveloper(request({ deploy: { developer: { name: "GTKX" } } })).id).toBe("com.gtkx");
    });

    it("leaves the developer id unset for a two-segment application id", () => {
        const identity = request({ applicationId: "org.app", deploy: { developer: { name: "GTKX" } } });
        expect(resolveDeveloper(identity).id).toBeNull();
    });

    it("names both sources when no developer can be found", () => {
        expect(() => resolveDeveloper(request({}))).toThrow(/deploy\.developer\.name.*author/s);
    });
});

describe("resolveLicense and resolveVersionString", () => {
    it("falls back to the package license and version", () => {
        const identity = withManifest({ license: "MPL-2.0", version: "1.2.3" });
        expect(resolveLicense(identity)).toBe("MPL-2.0");
        expect(resolveVersionString(identity)).toBe("1.2.3");
    });

    it("names both sources when no license can be found", () => {
        expect(() => resolveLicense(request({}))).toThrow(/deploy\.license.*license/s);
    });

    it("names both sources when no version can be found", () => {
        expect(() => resolveVersionString(request({}))).toThrow(/deploy\.version.*version/s);
    });
});
