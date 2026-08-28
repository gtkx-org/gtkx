import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.gtkx.navigation",
    codegen: false,
    future: {
        v2ByteArrays: true,
        v2ValueReturns: true,
        v2FinishResults: true,
        v2InoutReturns: true,
        v2ResourceImports: true,
        v2DefaultLibraries: true,
    },
});
