import { defineConfig } from "@gtkx/config";

export default defineConfig({
    libraries: ["Gtk-4.0", "Adw-1", "GtkSource-5"],
    applicationId: "org.gtkx.gtk-demo",
    codegen: false,
});
