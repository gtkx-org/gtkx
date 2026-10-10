import type {} from "vitest";

type NativeTestContext = {
    asanRuntime: string;
    coverageDirectory?: string;
};

declare module "vitest" {
    export interface ProvidedContext {
        nativeTest: NativeTestContext;
    }
}

export type { NativeTestContext };
