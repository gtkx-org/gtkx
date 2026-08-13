import { readFileSync } from "node:fs";
import type { PackageFamily } from "./types.js";

type FamilyPackages = Partial<Record<PackageFamily, string>>;

const OS_RELEASE_PATH = "/etc/os-release";
const OS_RELEASE_LINE = /^(?<key>[A-Z_]+)=(?<value>.*)$/;
const QUOTED = /^"(.*)"$/;

const FAMILY_BY_ID: Record<string, PackageFamily> = {
    arch: "arch",
    debian: "debian",
    fedora: "fedora",
    manjaro: "arch",
    opensuse: "suse",
    "opensuse-leap": "suse",
    "opensuse-tumbleweed": "suse",
    rhel: "fedora",
    sles: "suse",
    suse: "suse",
    ubuntu: "debian",
};

const INSTALL_COMMAND: Partial<Record<PackageFamily, string>> = {
    arch: "sudo pacman -S",
    debian: "sudo apt install",
    fedora: "sudo dnf install",
    suse: "sudo zypper install",
};

const PACKAGE_FOR_TOOL: Record<string, FamilyPackages> = {
    appstreamcli: { arch: "appstream", debian: "appstream", fedora: "appstream", suse: "AppStream" },
    "desktop-file-validate": {
        arch: "desktop-file-utils",
        debian: "desktop-file-utils",
        fedora: "desktop-file-utils",
        suse: "desktop-file-utils",
    },
    file: { arch: "file", debian: "file", fedora: "file", suse: "file" },
    "flatpak-builder": {
        arch: "flatpak-builder",
        debian: "flatpak-builder",
        fedora: "flatpak-builder",
        suse: "flatpak-builder",
    },
    strip: { arch: "binutils", debian: "binutils", fedora: "binutils", suse: "binutils" },
    tar: { arch: "tar", debian: "tar", fedora: "tar", suse: "tar" },
};

const EXTRA_HINTS: Record<string, string> = {
    "flatpak-builder": "or: flatpak install --user -y flathub org.flatpak.Builder",
    "flatpak-node-generator":
        "pipx install git+https://github.com/flatpak/flatpak-builder-tools.git#subdirectory=node",
};

const unquote = (value: string): string => QUOTED.exec(value)?.[1] ?? value;

const readOsReleaseText = (): string => {
    try {
        return readFileSync(OS_RELEASE_PATH, "utf8");
    } catch {
        return "";
    }
};

const osReleaseEntry = (line: string): [string, string] | null => {
    const match = OS_RELEASE_LINE.exec(line.trim());

    return match?.groups ? [match.groups.key ?? "", unquote(match.groups.value ?? "")] : null;
};

const readOsRelease = (): Record<string, string> =>
    Object.fromEntries(
        readOsReleaseText()
            .split("\n")
            .map((line) => osReleaseEntry(line))
            .filter((entry) => entry !== null),
    );

const familyForIds = (ids: string[]): PackageFamily => {
    for (const id of ids) {
        const family = FAMILY_BY_ID[id];

        if (family !== undefined) {
            return family;
        }
    }

    return "unknown";
};

const detectPackageFamily = (): PackageFamily => {
    const release = readOsRelease();
    const like = (release.ID_LIKE ?? "").split(" ").filter((entry) => entry.length > 0);

    return familyForIds([release.ID ?? "", ...like]);
};

const installHints = (tool: string, family: PackageFamily): string[] => {
    const packageName = PACKAGE_FOR_TOOL[tool]?.[family];
    const command = INSTALL_COMMAND[family];
    const extra = EXTRA_HINTS[tool];
    const install = packageName !== undefined && command !== undefined ? [`${command} ${packageName}`] : [];

    return extra === undefined ? install : [...install, extra];
};

export { detectPackageFamily, installHints };
