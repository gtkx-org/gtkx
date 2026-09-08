type RootConfig = {
    root?: string | undefined;
    test?: { root?: string | undefined } | undefined;
};

const viteProjectRoot = (config: RootConfig): string => config.test?.root ?? config.root ?? process.cwd();

export { viteProjectRoot };
