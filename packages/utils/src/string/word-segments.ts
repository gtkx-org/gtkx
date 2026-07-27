function splitWords(input: string): string[] {
    return input.split(/[_-]/g).filter((part) => part.length > 0);
}

function mapWordSegments(input: string, mapSegment: (part: string, index: number) => string): string {
    const parts = splitWords(input);

    if (parts.length === 0) {
        return input;
    }

    return parts.map((part, index) => mapSegment(part, index)).join("");
}

export { mapWordSegments };
