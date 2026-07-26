declare module "babel-plugin-react-compiler" {
    import type { PluginTarget } from "@babel/core";
    const plugin: PluginTarget & { default?: PluginTarget };
    export default plugin;
}

declare module "@babel/preset-typescript" {
    import type { PresetTarget } from "@babel/core";
    const preset: PresetTarget & { default?: PresetTarget };
    export default preset;
}
