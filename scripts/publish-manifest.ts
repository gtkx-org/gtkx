type ExportsField = string | null | { [key: string]: ExportsField };

type PackageManifest = {
    name?: string;
    version?: string;
    private?: boolean;
    files?: string[];
    bin?: string | Record<string, string>;
    exports?: ExportsField;
    [field: string]: unknown;
};

const distTagForVersion = (version: string): string => {
    const core = version.split("+", 1)[0] ?? "";
    const dashIndex = core.indexOf("-");

    if (dashIndex === -1) {
        return "latest";
    }

    const identifier = core.slice(dashIndex + 1).split(".", 1)[0] ?? "";

    return identifier === "" || /^\d+$/.test(identifier) ? "next" : identifier;
};

export { distTagForVersion, type PackageManifest };
