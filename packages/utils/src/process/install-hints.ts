import { readFileSync } from "node:fs";

type PackageFamily = "arch" | "debian" | "fedora" | "suse" | "unknown";

type FamilyPackages = Partial<Record<PackageFamily, string>>;

/** A command-line tool GTKX runs from `PATH`, described for messages that report it missing. */
type ExternalTool = {
    /** Executable name looked up on `PATH`. */
    command: string;
    /** What the tool does, phrased to follow its name, as in "builds the Flatpak". */
    purpose: string;
};

/** The executables every GTKX headless display runs: its Wayland compositor and its D-Bus session bus. */
const HEADLESS_DISPLAY_TOOLS: Record<"compositor" | "bus", ExternalTool> = {
    compositor: { command: "sway", purpose: "provides the headless Wayland display" },
    bus: { command: "dbus-daemon", purpose: "provides the private D-Bus session bus" },
};

const DETAIL_COLUMN = 26;
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
    "dbus-daemon": { arch: "dbus", debian: "dbus-daemon", fedora: "dbus-daemon", suse: "dbus-1-daemon" },
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
    msgfmt: { arch: "gettext", debian: "gettext", fedora: "gettext", suse: "gettext-tools" },
    msginit: { arch: "gettext", debian: "gettext", fedora: "gettext", suse: "gettext-tools" },
    msggrep: { arch: "gettext", debian: "gettext", fedora: "gettext", suse: "gettext-tools" },
    msgmerge: { arch: "gettext", debian: "gettext", fedora: "gettext", suse: "gettext-tools" },
    strip: { arch: "binutils", debian: "binutils", fedora: "binutils", suse: "binutils" },
    sway: { arch: "sway", debian: "sway", fedora: "sway", suse: "sway" },
    tar: { arch: "tar", debian: "tar", fedora: "tar", suse: "tar" },
    xgettext: { arch: "gettext", debian: "gettext", fedora: "gettext", suse: "gettext-tools" },
};

const GENERATOR_SOURCE = "git+https://github.com/flatpak/flatpak-builder-tools.git#subdirectory=node";

const EXTRA_HINTS: Record<string, string[]> = {
    "flatpak-builder": ["or: flatpak install --user -y flathub org.flatpak.Builder"],
    "flatpak-node-generator": [
        `pipx install ${GENERATOR_SOURCE}`,
        `or, when the installed copy is too old to vendor pnpm: pipx install --force ${GENERATOR_SOURCE}`,
    ],
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
    const install = packageName !== undefined && command !== undefined ? [`${command} ${packageName}`] : [];

    return [...install, ...(EXTRA_HINTS[tool] ?? [])];
};

const pad = (text: string): string => text.padEnd(DETAIL_COLUMN);

/** Lists each tool with its purpose and how to install it on the running distribution, aligned for a terminal. */
const missingToolLines = (tools: readonly ExternalTool[]): string[] => {
    const family = detectPackageFamily();

    return tools.flatMap((tool) => [
        `  ${pad(tool.command)}${tool.purpose}`,
        ...installHints(tool.command, family).map((hint) => `  ${pad("")}${hint}`),
    ]);
};

export { type ExternalTool, HEADLESS_DISPLAY_TOOLS, missingToolLines };
