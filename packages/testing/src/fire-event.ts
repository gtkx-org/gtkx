import type * as GObject from "@gtkx/gi/gobject";
import { act } from "./act.js";

export const fireEvent = async (element: GObject.Object, signalName: string, ...args: unknown[]): Promise<void> => {
    await act(() => {
        element.emit(signalName, ...args);
    });
};
