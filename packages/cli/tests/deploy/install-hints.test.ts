import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { PackageFamily } from "../../src/deploy/types.js";
import { detectPackageFamily, installHints } from "../../src/deploy/install-hints.js";

const FAMILIES: PackageFamily[] = ["arch", "debian", "fedora", "suse", "unknown"];
const FLATPAK_BUILDER_HINT = "or: flatpak install --user -y flathub org.flatpak.Builder";
const NODE_GENERATOR_HINT = "pipx install git+https://github.com/flatpak/flatpak-builder-tools.git#subdirectory=node";

const familyFrom = (text: string): PackageFamily => {
    vi.mocked(readFileSync).mockReturnValueOnce(text);

    return detectPackageFamily();
};

vi.mock("node:fs", async (importOriginal) => {
    const original = await importOriginal<typeof import("node:fs")>();

    return { ...original, default: original, readFileSync: vi.fn(original.readFileSync) };
});

describe("installHints — one command per family", () => {
    it("uses apt on debian", () => {
        expect(installHints("appstreamcli", "debian")).toEqual(["sudo apt install appstream"]);
    });

    it("uses dnf on fedora", () => {
        expect(installHints("appstreamcli", "fedora")).toEqual(["sudo dnf install appstream"]);
    });

    it("uses pacman on arch", () => {
        expect(installHints("appstreamcli", "arch")).toEqual(["sudo pacman -S appstream"]);
    });

    it("uses zypper on suse, where the package is capitalized", () => {
        expect(installHints("appstreamcli", "suse")).toEqual(["sudo zypper install AppStream"]);
    });

    it("gives no install line when the family is unknown", () => {
        expect(installHints("appstreamcli", "unknown")).toEqual([]);
    });
});

describe("installHints — package names", () => {
    it("maps desktop-file-validate to desktop-file-utils", () => {
        expect(installHints("desktop-file-validate", "debian")).toEqual(["sudo apt install desktop-file-utils"]);
    });

    it("maps strip to binutils", () => {
        expect(installHints("strip", "fedora")).toEqual(["sudo dnf install binutils"]);
    });

    it("keeps the tool name when it matches the package name", () => {
        expect(installHints("tar", "arch")).toEqual(["sudo pacman -S tar"]);
        expect(installHints("file", "suse")).toEqual(["sudo zypper install file"]);
    });

    it("gives no install line for a tool with no known package", () => {
        expect(installHints("cmake", "debian")).toEqual([]);
    });

    it("gives no install line for an unknown tool on an unknown family", () => {
        expect(installHints("cmake", "unknown")).toEqual([]);
    });

    it("gives a single line for a tool that carries no extra hint", () => {
        expect(installHints("appstreamcli", "debian")).toHaveLength(1);
    });
});

describe("installHints — extra hints", () => {
    it("adds the flatpak hint after the distribution command", () => {
        expect(installHints("flatpak-builder", "debian")).toEqual([
            "sudo apt install flatpak-builder",
            FLATPAK_BUILDER_HINT,
        ]);
    });

    it("keeps the flatpak hint for every family that packages the builder", () => {
        expect(installHints("flatpak-builder", "suse")).toEqual([
            "sudo zypper install flatpak-builder",
            FLATPAK_BUILDER_HINT,
        ]);
    });

    it("offers only the flatpak hint when the family is unknown", () => {
        expect(installHints("flatpak-builder", "unknown")).toEqual([FLATPAK_BUILDER_HINT]);
    });

    it("offers the pipx hint for a tool no distribution packages", () => {
        expect(installHints("flatpak-node-generator", "debian")).toEqual([NODE_GENERATOR_HINT]);
    });

    it("offers the same pipx hint whatever the family", () => {
        expect(installHints("flatpak-node-generator", "arch")).toEqual([NODE_GENERATOR_HINT]);
        expect(installHints("flatpak-node-generator", "unknown")).toEqual([NODE_GENERATOR_HINT]);
    });
});

describe("detectPackageFamily", () => {
    it("reports one of the known families for the host", () => {
        expect(FAMILIES).toContain(detectPackageFamily());
    });

    it("maps ubuntu to debian", () => {
        expect(familyFrom("ID=ubuntu\n")).toBe("debian");
    });

    it("maps manjaro to arch", () => {
        expect(familyFrom("ID=manjaro\n")).toBe("arch");
    });

    it("maps every opensuse spelling to suse", () => {
        expect(familyFrom("ID=opensuse-tumbleweed\n")).toBe("suse");
        expect(familyFrom("ID=sles\n")).toBe("suse");
    });

    it("maps rhel to fedora", () => {
        expect(familyFrom("ID=rhel\n")).toBe("fedora");
    });
});

describe("detectPackageFamily — parsing", () => {
    it("strips the quotes around a value", () => {
        expect(familyFrom('ID="fedora"\n')).toBe("fedora");
    });

    it("falls back to ID_LIKE when the id itself is unknown", () => {
        expect(familyFrom('ID=pop\nID_LIKE="ubuntu debian"\n')).toBe("debian");
    });

    it("prefers the id over ID_LIKE", () => {
        expect(familyFrom("ID=fedora\nID_LIKE=arch\n")).toBe("fedora");
    });

    it("ignores lines that are not uppercase assignments", () => {
        expect(familyFrom("# a comment\nversion=1\n\nID=arch\n")).toBe("arch");
    });

    it("returns unknown for a distribution it does not recognize", () => {
        expect(familyFrom('ID=gentoo\nID_LIKE=""\n')).toBe("unknown");
    });

    it("returns unknown when there is no id at all", () => {
        expect(familyFrom('NAME="Mystery"\n')).toBe("unknown");
    });

    it("returns unknown when the release file cannot be read", () => {
        vi.mocked(readFileSync).mockImplementationOnce(() => {
            throw new Error("ENOENT");
        });

        expect(detectPackageFamily()).toBe("unknown");
    });
});
