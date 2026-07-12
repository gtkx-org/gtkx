import type * as GObject from "@gtkx/gi/gobject";
import type { RootElement } from "./root-element.js";

/**
 * A mount target for the reconciler: either a GObject or the root element.
 */
export type Container = GObject.Object | RootElement;

export type Props = Record<string, unknown>;
