import { defineConfig } from "@gtkx/config";

export default defineConfig({
    libraries: ["GtkSource-5"],
    applicationId: "org.gtkx.gtk-demo",
    codegen: false,
    applicationIcon: "data/icons/org.gtk.Demo4.svg",
    future: {
        v2ByteArrays: true,
        v2ValueReturns: true,
        v2FinishResults: true,
        v2InoutReturns: true,
        v2ResourceImports: true,
        v2DefaultLibraries: true,
    },
});
