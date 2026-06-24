import type * as GObject from "@gtkx/gi/gobject";
import type { RootElement } from "./root-element.js";

export type Container = GObject.Object | RootElement;

export type Props = Record<string, unknown>;
