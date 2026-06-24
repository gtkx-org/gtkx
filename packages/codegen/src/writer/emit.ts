export const indent = (block: string, level: number): string => {
    if (level <= 0) return block;
    const prefix = "    ".repeat(level);
    return block
        .split("\n")
        .map((line) => (line.length === 0 ? line : `${prefix}${line}`))
        .join("\n");
};

export const renderBlock = (head: string, body: string): string => `${head} {\n${indent(body, 1)}\n}`;

export const renderBraced = (body: string): string => `{\n${indent(body, 1)}\n}`;

export const renderBracedOrEmpty = (head: string, body: string): string =>
    body.length === 0 ? `${head} {}` : renderBlock(head, body);

export const indentMembers = (members: string[]): string => members.map((member) => indent(member, 1)).join("\n\n");

export const joinArgs = (parts: Array<string | undefined>): string =>
    parts.filter((part): part is string => part !== undefined).join(", ");

export const arrayLiteral = (elements: string[]): string => {
    if (elements.length === 0) return "[]";
    const lines = elements.map((element) => `    ${element},`);
    return `[\n${lines.join("\n")}\n]`;
};
