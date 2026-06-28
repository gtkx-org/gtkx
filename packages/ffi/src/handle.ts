import type { ExternalObject, Handle as NativeHandle } from "@gtkx/native";

/** A native handle value: a branded {@link NativeHandle} marker carried by an `ExternalObject`. */
export type Handle = ExternalObject<NativeHandle>;
