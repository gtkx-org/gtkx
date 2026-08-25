const girPath = process.env.GTKX_GIR_PATH;

export default {
    applicationId: "org.gtkx.root",
    libraries: ["Gtk-4.0", "Adw-1", "GtkSource-5", "WebKit-6.0"],
    future: { v2ByteArrays: true, v2ValueReturns: true, v2FinishResults: true, v2ResourceImports: true },
    ...(girPath && { girPath: [girPath] }),
};
