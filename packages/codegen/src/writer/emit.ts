const indent = (block: string, level: number): string => {
    if (level <= 0) {
        return block;
    }

    const prefix = " ".repeat(4).repeat(level);

    return block
        .split("\n")
        .map((line) => (line.length === 0 ? line : `${prefix}${line}`))
        .join("\n");
};

const renderBlock = (head: string, body: string): string => `${head} {\n${indent(body, 1)}\n}`;
const renderBraced = (body: string): string => `{\n${indent(body, 1)}\n}`;

const renderBracedOrEmpty = (head: string, body: string): string =>
    body.length === 0 ? `${head} {}` : renderBlock(head, body);

const indentMembers = (members: string[]): string => members.map((member) => indent(member, 1)).join("\n\n");

const joinArgs = (parts: (string | undefined)[]): string =>
    parts.filter((part): part is string => part !== undefined).join(", ");

const arrayLiteral = (elements: string[]): string => {
    if (elements.length === 0) {
        return "[]";
    }

    const lines = elements.map((element) => `    ${element},`);

    return `[\n${lines.join("\n")}\n]`;
};

export { indent, renderBlock, renderBraced, renderBracedOrEmpty, indentMembers, joinArgs, arrayLiteral };
