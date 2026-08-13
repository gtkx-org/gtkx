import type { DeployDesktopAction, DeploySettings } from "../types.js";
import { type IniGroup, renderIni } from "./ini.js";

type Entries = [string, string | string[]][];

const DESKTOP_ENTRY_GROUP = "Desktop Entry";
const EXEC_QUOTED_CHARACTERS = /["`$\\]/g;
const EXEC_RESERVED_CHARACTERS = /[\s"'\\><~|&;$*?#()`]/;

const RESERVED_KEYS = new Map([
    ["DBusActivatable", "use `deploy.isDbusActivatable` instead"],
    ["Version", "it names the desktop entry spec version, not the application's"],
]);

const quoteExecToken = (token: string): string => {
    const escaped = token.replaceAll("%", "%%");

    if (!EXEC_RESERVED_CHARACTERS.test(escaped)) {
        return escaped;
    }

    const quoted = escaped.replaceAll(EXEC_QUOTED_CHARACTERS, (character) => `\\${character}`);

    return `"${quoted}"`;
};

const execLine = (settings: DeploySettings): string =>
    [
        ...[settings.binaryName, ...settings.execArgs].map((part) => quoteExecToken(part)),
        settings.execToken ?? "",
    ]
        .filter((part) => part.length > 0)
        .join(" ");

const optionalEntry = (key: string, value: string | null): Entries => (value === null ? [] : [[key, value]]);
const listEntry = (key: string, values: string[]): Entries => (values.length === 0 ? [] : [[key, values]]);

const assertNoReservedOverrides = (settings: DeploySettings): void => {
    for (const key of Object.keys(settings.desktopEntry)) {
        const remedy = RESERVED_KEYS.get(key);

        if (remedy !== undefined) {
            throw new Error(`Cannot set "${key}" through \`deploy.desktopEntry\`: gtkx deploy writes it, ${remedy}`);
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
    settings.desktopActions.length === 0 ? [] : [["Actions", settings.desktopActions.map((action) => action.id)]];

const activationEntries = (settings: DeploySettings): Entries =>
    settings.isDbusActivatable ? [["DBusActivatable", "true"]] : [];

const actionGroup = (settings: DeploySettings, action: DeployDesktopAction): IniGroup => ({
    name: `Desktop Action ${action.id}`,
    entries: [
        ["Name", action.name],
        ["Exec", [settings.binaryName, ...action.args].map((part) => quoteExecToken(part)).join(" ")],
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
