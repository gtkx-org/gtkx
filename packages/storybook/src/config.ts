/** Story discovery and preview configuration for the native explorer. */
type StorybookConfig = {
    /** Project-relative globs; defaults to CSF story files under src. */
    stories?: string[];
    /** Additional project-relative globs excluded from discovery. */
    exclude?: string[];
    /** Project-relative preview module; defaults to a discovered .storybook/preview file. */
    preview?: string;
};

/** Returns a typed explorer configuration without changing it or resolving its paths. */
const defineConfig = (config: StorybookConfig): StorybookConfig => config;

export { defineConfig, type StorybookConfig };
