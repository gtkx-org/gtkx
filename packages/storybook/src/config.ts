type StorybookConfig = {
    stories?: string[];
    exclude?: string[];
    preview?: string;
};

const defineConfig = (config: StorybookConfig): StorybookConfig => config;

export { defineConfig, type StorybookConfig };
