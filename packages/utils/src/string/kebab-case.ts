function kebabCase(str: string): string {
    return str.replaceAll(/[A-Z]/g, (char, index: number) =>
        index === 0 ? char.toLowerCase() : `-${char.toLowerCase()}`,
    );
}

export { kebabCase };
