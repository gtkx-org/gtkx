import type * as GObject from "@gtkx/gi/gobject";
import type { RootElement } from "./root-element.js";

/**
 * What `react-reconciler` hands the host config as `containerInfo`: either the
 * per-root {@link RootElement} created by `createRootElement` or a live GObject
 * when a portal targets one (e.g. a window passed to `createPortal`).
 */
export type ContainerInfo = GObject.Object | RootElement;

export type Props = Record<string, unknown>;
