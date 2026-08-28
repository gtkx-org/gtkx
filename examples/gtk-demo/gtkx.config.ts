import { defineConfig } from "@gtkx/config";

export default defineConfig({
    libraries: ["Gtk-4.0", "Adw-1", "GtkSource-5"],
    applicationId: "org.gtkx.gtk-demo",
    codegen: false,
    applicationIcon: "data/icons/org.gtk.Demo4.svg",
    future: {
        v2ByteArrays: true,
        v2ValueReturns: true,
        v2FinishResults: true,
        v2InoutReturns: true,
        v2ResourceImports: true,
    },
});
