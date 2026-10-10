import type {} from "vitest";

type NativeTestContext = {
    asanRuntime: string;
    coverageDirectory?: string;
};

declare module "vitest" {
    interface ProvidedContext {
        nativeTest: NativeTestContext;
    }
}

export type { NativeTestContext };
