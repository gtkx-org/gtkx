type EnumFlattening = {
    text: string;
    flattened: number;
};

const DOWNLEVELED_ENUM = /^export var ([\w$]+);\n\(function \(\1\) \{\n([\S\s]*?)\}\)\(\1 \|\| \(\1 = \{\}\)\);\n/gmu;
const ENUM_DECLARATION = /^export enum [\w$]+/gmu;
const ENUM_MEMBER = /^ {4}[\w$]+\[[\w$]+\[("[^"]*")\] = (-?\d+)\] = ("[^"]*");$/gmu;

const memberLines = (body: string): string[] => body.split("\n").filter((line) => line.length > 0);
const isMember = (line: string): boolean => line.replaceAll(ENUM_MEMBER, "").length === 0;
const entryLines = (line: string): string[] => line.replaceAll(ENUM_MEMBER, '$1: $2\n"$2": $3').split("\n");

const enumEntries = (lines: string[]): string[] => {
    const entries: Map<string, string> = new Map();
    const written = lines.flatMap((line) => entryLines(line));

    for (const entry of written) {
        entries.set(entry.slice(0, entry.indexOf(":")), entry);
    }

    return entries.values().toArray();
};

const enumObject = (body: string): string | undefined => {
    const lines = memberLines(body);

    if (lines.some((line) => !isMember(line))) {
        return undefined;
    }

    const entries = enumEntries(lines).map((entry) => `    ${entry},`);

    return entries.length === 0 ? "{}" : `{\n${entries.join("\n")}\n}`;
};

const flattenEnums = (text: string): EnumFlattening => {
    let flattened = 0;

    const output = text.replaceAll(DOWNLEVELED_ENUM, (statement: string, name: string, body: string): string => {
        const object = enumObject(body);

        if (object === undefined) {
            return statement;
        }

        flattened += 1;

        return `export var ${name} = ${object};\n`;
    });

    return { text: output, flattened };
};

const countEnumDeclarations = (text: string): number => text.match(ENUM_DECLARATION)?.length ?? 0;

export { countEnumDeclarations, flattenEnums };
