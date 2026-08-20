import type { ExternalObject, Handle } from "@gtkx/runtime";
import { t } from "@gtkx/runtime";
import { Status } from "./enums.js";
import { bindCairo, SURFACE_T } from "./lib.js";
import { statusToString } from "./version.js";

const cairoSurfaceStatus = bindCairo("cairo_surface_status", [SURFACE_T], t.int32);

const checkStatus = (status: Status, subject: string): void => {
    if (status === Status.SUCCESS) {
        return;
    }

    throw new Error(`cairo error on ${subject}: "${statusToString(status)}" (${String(status)})`);
};

const checkSurface = (handle: ExternalObject<Handle>): ExternalObject<Handle> => {
    checkStatus(cairoSurfaceStatus(handle) as Status, "surface");

    return handle;
};

export { checkStatus, checkSurface };
