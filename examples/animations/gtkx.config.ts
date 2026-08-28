import { defineConfig } from "@gtkx/config";

export default defineConfig({
    libraries: ["Gtk-4.0"],
    applicationId: "com.gtkx.animations",
    codegen: false,
    future: {
        v2ByteArrays: true,
        v2ValueReturns: true,
        v2FinishResults: true,
        v2InoutReturns: true,
        v2ResourceImports: true,
    },
});
