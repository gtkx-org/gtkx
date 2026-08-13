import { describe, expect, it } from "vitest";
import { resolveArch } from "../../../src/deploy/settings/arch.js";

describe("resolveArch", () => {
    it("maps x64 onto every packaging vocabulary", () => {
        expect(resolveArch("x64")).toEqual({
            deb: "amd64",
            rpm: "x86_64",
            flatpak: "x86_64",
            appimage: "x86_64",
            node: "x64",
        });
    });

    it("maps arm64 onto every packaging vocabulary", () => {
        expect(resolveArch("arm64")).toEqual({
            deb: "arm64",
            rpm: "aarch64",
            flatpak: "aarch64",
            appimage: "aarch64",
            node: "arm64",
        });
    });

    it("names the supported set for an unsupported architecture", () => {
        expect(() => resolveArch("ppc64")).toThrow("Cannot deploy for ppc64: only arm64 and x64 are supported");
    });
});
