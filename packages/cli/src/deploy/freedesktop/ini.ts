type IniGroup = {
    name: string;
    entries: [string, string | string[]][];
};

const FORBIDDEN_VALUE_CHARACTERS = /[\n\r]/;

const assertValue = (key: string, value: string): void => {
    if (FORBIDDEN_VALUE_CHARACTERS.test(value)) {
        throw new Error(`Cannot write "${key}" into a desktop entry: its value contains a line break`);
    }
};

const escapeValue = (key: string, value: string): string => {
    assertValue(key, value);

    return value.replaceAll("\\", "\\\\");
};

const escapeListItem = (key: string, value: string): string => escapeValue(key, value).replaceAll(";", String.raw`\;`);

const renderList = (key: string, values: string[]): string =>
    values.length === 0 ? "" : `${values.map((item) => escapeListItem(key, item)).join(";")};`;

const renderValue = (key: string, value: string | string[]): string =>
    Array.isArray(value) ? renderList(key, value) : escapeValue(key, value);

const renderEntry = ([key, value]: [string, string | string[]]): string => `${key}=${renderValue(key, value)}`;

const renderGroup = (group: IniGroup): string[] => [
    `[${group.name}]`,
    ...group.entries.map((entry) => renderEntry(entry)),
];

const renderIni = (groups: IniGroup[]): string =>
    [...groups.flatMap((group, index) => (index === 0 ? renderGroup(group) : ["", ...renderGroup(group)])), ""]
        .join("\n");

export { type IniGroup, renderIni };
