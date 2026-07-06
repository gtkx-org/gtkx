import { getWrapperClass, type TypedClass } from "@gtkx/ffi";
import * as GObject from "@gtkx/gi/gobject";

export type { TypedClass };

const describeUnregistered = (typeName: string): string =>
    `${typeName} is not registered. Import its @gtkx/jsx namespace module (e.g. \`import "@gtkx/jsx/adw"\`) before use.`;

export const requireClassByName = (typeName: string): (new (props: Record<string, unknown>) => GObject.Object) => {
    const gtype = GObject.typeFromName(typeName);
    if (gtype === GObject.TYPE_INVALID) throw new Error(describeUnregistered(typeName));
    return getWrapperClass(gtype) as new (
        props: Record<string, unknown>,
    ) => GObject.Object;
};
