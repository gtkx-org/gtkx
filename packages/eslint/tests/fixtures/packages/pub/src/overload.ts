function convert(value: string): string;
function convert(value: number): number;
function convert(value: string | number): string | number {
    return value;
}

export { convert };
