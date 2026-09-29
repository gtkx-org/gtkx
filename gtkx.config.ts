const girPath = process.env.GTKX_GIR_PATH;

export default {
    applicationId: "org.gtkx.root",
    libraries: ["GtkSource-5", "WebKit-6.0"],
    ...(girPath && { girPath: [girPath] }),
};
