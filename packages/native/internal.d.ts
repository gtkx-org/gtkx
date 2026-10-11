export {
    activateProcessWatch,
    armParentDeath,
    closeProcessWatch,
    encodePointer,
    openProcessWatch,
    retainPropertyPointer,
} from "./index.js";

declare module "./index.js" {
    export type ProcessWatch = { _opaque: "ProcessWatch" };
}
