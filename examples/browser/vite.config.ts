export default {
    resolve: {
        dedupe: ["@gtkx/gi", "@gtkx/jsx"],
    },
    ssr: {
        noExternal: ["@gtkx/gi", "@gtkx/jsx"],
    },
};
