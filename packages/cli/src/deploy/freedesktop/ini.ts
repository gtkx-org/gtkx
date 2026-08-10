type IniGroup = {
    name: string;
    entries: [string, string][];
};

const FORBIDDEN_VALUE_CHARACTERS = /[\n\r]/;

const assertValue = (key: string, value: string): void => {
    if (FORBIDDEN_VALUE_CHARACTERS.test(value)) {
        throw new Error(`Cannot write "${key}" into a desktop entry: its value contains a line break`);
    }
};

const renderEntry = ([key, value]: [string, string]): string => {
    assertValue(key, value);

    return `${key}=${value}`;
};

const renderGroup = (group: IniGroup): string[] => [
    `[${group.name}]`,
    ...group.entries.map((entry) => renderEntry(entry)),
];

const renderIni = (groups: IniGroup[]): string =>
    [...groups.flatMap((group, index) => (index === 0 ? renderGroup(group) : ["", ...renderGroup(group)])), ""]
        .join("\n");

const listValue = (values: string[]): string => (values.length === 0 ? "" : `${values.join(";")};`);

export { type IniGroup, listValue, renderIni };
