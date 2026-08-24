import { type ExternalObject, type Handle, t } from "@gtkx/runtime";
import { bindCairo, CONTEXT_T, PATTERN_T, SURFACE_MAPPING_LEASE } from "./lib.js";

const RAW_POINTER_T = t.struct("borrowed");
const SURFACE_ACCESS_POINTER_T = SURFACE_MAPPING_LEASE.access(RAW_POINTER_T);
const cairoSurfaceStatusForAccess = bindCairo("cairo_surface_status", [SURFACE_ACCESS_POINTER_T], t.int32);
const cairoGetGroupTargetPointer = bindCairo("cairo_get_group_target", [CONTEXT_T], RAW_POINTER_T);
const cairoGetSourcePointer = bindCairo("cairo_get_source", [CONTEXT_T], RAW_POINTER_T);

const cairoPatternGetSurfacePointer = bindCairo(
    "cairo_pattern_get_surface",
    [PATTERN_T, t.ref(RAW_POINTER_T)],
    t.int32,
);

const assertSurfaceCanBeSourceOrTarget = (surface: ExternalObject<Handle>): void => {
    cairoSurfaceStatusForAccess(surface);
};

const assertPatternCanBeSource = (pattern: ExternalObject<Handle>): void => {
    const surface: { value: ExternalObject<Handle> | null } = { value: null };
    cairoPatternGetSurfacePointer(pattern, surface);

    if (surface.value !== null) {
        assertSurfaceCanBeSourceOrTarget(surface.value);
    }
};

const assertContextCanDraw = (context: ExternalObject<Handle>): void => {
    const target = cairoGetGroupTargetPointer(context) as ExternalObject<Handle> | null;

    if (target !== null) {
        assertSurfaceCanBeSourceOrTarget(target);
    }

    const source = cairoGetSourcePointer(context) as ExternalObject<Handle> | null;

    if (source !== null) {
        assertPatternCanBeSource(source);
    }
};

export { assertContextCanDraw, assertPatternCanBeSource };
