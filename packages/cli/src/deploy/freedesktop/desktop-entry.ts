import type { DeployDesktopAction, DeploySettings } from "../types.js";
import { type IniGroup, listValue, renderIni } from "./ini.js";

type Entries = [string, string][];

const DESKTOP_ENTRY_GROUP = "Desktop Entry";
const RESERVED_KEYS = new Set(["DBusActivatable", "Version"]);

const execLine = (settings: DeploySettings): string =>
    [settings.binaryName, ...settings.execArgs, settings.execToken ?? ""].filter((part) => part.length > 0).join(" ");

const optionalEntry = (key: string, value: string | null): Entries => (value === null ? [] : [[key, value]]);

const listEntry = (key: string, values: string[]): Entries =>
    values.length === 0 ? [] : [[key, listValue(values)]];

const assertNoReservedOverrides = (settings: DeploySettings): void => {
    for (const key of Object.keys(settings.desktopEntry)) {
        if (RESERVED_KEYS.has(key)) {
            throw new Error(
                `Cannot set "${key}" through \`deploy.desktopEntry\`: gtkx deploy writes it. ` +
                "Use `deploy.isDbusActivatable` instead.",
            );
        }
    }
};

const baseEntries = (settings: DeploySettings): Entries => [
    ["Type", "Application"],
    ["Name", settings.name],
    ...optionalEntry("GenericName", settings.genericName),
    ["Comment", settings.summary],
    ["Exec", execLine(settings)],
    ["Icon", settings.applicationId],
    ["Terminal", "false"],
    ...listEntry("Categories", settings.categories),
    ...listEntry("Keywords", settings.keywords),
    ...listEntry("MimeType", settings.mimeTypes),
    ["StartupNotify", "true"],
    ["StartupWMClass", settings.applicationId],
];

const actionEntries = (settings: DeploySettings): Entries =>
    settings.desktopActions.length === 0
        ? []
        : [["Actions", listValue(settings.desktopActions.map((action) => action.id))]];

const activationEntries = (settings: DeploySettings): Entries =>
    settings.isDbusActivatable ? [["DBusActivatable", "true"]] : [];

const actionGroup = (settings: DeploySettings, action: DeployDesktopAction): IniGroup => ({
    name: `Desktop Action ${action.id}`,
    entries: [
        ["Name", action.name],
        ["Exec", [settings.binaryName, ...action.args].join(" ")],
        ...optionalEntry("Icon", action.icon),
    ],
});

const mergeEntries = (entries: Entries, overrides: Entries): Entries => {
    const merged = new Map(entries);

    for (const [key, value] of overrides) {
        merged.set(key, value);
    }

    return merged.entries().toArray();
};

const renderDesktopEntry = (settings: DeploySettings): string => {
    assertNoReservedOverrides(settings);

    const main: IniGroup = {
        name: DESKTOP_ENTRY_GROUP,
        entries: mergeEntries(
            [...baseEntries(settings), ...actionEntries(settings), ...activationEntries(settings)],
            Object.entries(settings.desktopEntry),
        ),
    };

    return renderIni([main, ...settings.desktopActions.map((action) => actionGroup(settings, action))]);
};

export { renderDesktopEntry };
