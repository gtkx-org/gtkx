import { defineConfig } from "@gtkx/config";

export default defineConfig({
    libraries: ["WebKit-6.0"],
    applicationId: "com.gtkx.browser",
    codegen: false,
    future: {
        v2ByteArrays: true,
        v2ValueReturns: true,
        v2FinishResults: true,
        v2InoutReturns: true,
        v2ResourceImports: true,
        v2DefaultLibraries: true,
        v2TreeShaking: true,
    },
});
