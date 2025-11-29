export const getSourcePath = (importMetaUrl: string, filename: string): string => {
    const dir = new URL(".", importMetaUrl).pathname;
    return dir.replace("/dist/", "/src/") + filename;
};
