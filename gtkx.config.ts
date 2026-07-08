const girPath = process.env.GTKX_GIR_PATH;

export default {
    libraries: ["Gtk-4.0", "Adw-1", "GtkSource-5"],
    ...(girPath ? { girPath: [girPath] } : {}),
};
