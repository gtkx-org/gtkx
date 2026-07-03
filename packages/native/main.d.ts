export * from "./index.js";

declare module "./index.js" {
    export type Handle = { __opaque: "Handle" };
    export type CallDescriptor = { __opaque: "CallDescriptor" };
    export type Ref = { value: unknown };
}
