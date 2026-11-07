type Note = {
    name: string;
    text: string;
    modified: number;
    excerpt: string;
};

const firstLine = (text: string): string =>
    text
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line !== "" && !line.startsWith("#")) ?? "";

const toNote = (name: string, text: string, modified: number): Note => ({
    name,
    text,
    modified,
    excerpt: firstLine(text),
});

export { type Note, toNote };
