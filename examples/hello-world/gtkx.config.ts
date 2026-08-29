import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.gtkx.hello-world",
    codegen: false,
    applicationIcon: "data/icons",
    deploy: {
        name: "Hello World",
        summary: "Count things with a native GTK4 window",
        description: [
            "A tiny counter application that demonstrates how a GTKX project builds and packages itself.",
        ],
        categories: ["Utility"],
        developer: { name: "GTKX", email: "hello@gtkx.dev" },
        homepage: "https://gtkx.dev",
        license: "MPL-2.0",
        targets: ["appimage", "deb", "rpm"],
    },
});
