const girPath = process.env.GTKX_GIR_PATH;

export default {
    applicationId: "org.gtkx.root",
    libraries: ["GtkSource-5", "WebKit-6.0"],
    future: {
        v2ByteArrays: true,
        v2ValueReturns: true,
        v2FinishResults: true,
        v2InoutReturns: true,
        v2ResourceImports: true,
        v2DefaultLibraries: true,
        v2TreeShaking: true,
    },
    ...(girPath && { girPath: [girPath] }),
};
