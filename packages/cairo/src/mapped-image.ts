import { type ExternalObject, getHandle, type Handle, t } from "@gtkx/runtime";
import { clonePointerBorrow, endPointerBorrow, handlesPointToSameMemory } from "@gtkx/runtime/internal";
import { bindCairo, SURFACE_FULL_T, SURFACE_T } from "./lib.js";

type MappedImageState = {
    borrow: ExternalObject<Handle>;
    image: ExternalObject<Handle>;
    source: ExternalObject<Handle>;
    target: WeakRef<ExternalObject<Handle>>;
    token: object;
};

const cairoSurfaceReference = bindCairo("cairo_surface_reference", [SURFACE_T], SURFACE_FULL_T);
const cairoSurfaceUnmapImage = bindCairo("cairo_surface_unmap_image", [SURFACE_T, SURFACE_T], t.void);
const activeMappedImages: Set<MappedImageState> = new Set();

const mappedImageReclaimer: FinalizationRegistry<MappedImageState> = new FinalizationRegistry((state) => {
    releaseMappedImage(state);
});

const mappedImageStateForTarget = (handle: ExternalObject<Handle>): MappedImageState | undefined => {
    for (const state of activeMappedImages) {
        if (state.target.deref() === handle) {
            return state;
        }
    }

    return undefined;
};

const mappedImageStateForPointer = (handle: ExternalObject<Handle>): MappedImageState | undefined => {
    for (const state of activeMappedImages) {
        if (handlesPointToSameMemory(handle, state.image)) {
            return state;
        }
    }

    return undefined;
};

const mappedImageStateFor = (handle: ExternalObject<Handle>): MappedImageState | undefined =>
    mappedImageStateForTarget(handle) ?? mappedImageStateForPointer(handle);

const isParticipatingInMapping = (handle: ExternalObject<Handle>): boolean => {
    for (const state of activeMappedImages) {
        if (handlesPointToSameMemory(handle, state.source) || handlesPointToSameMemory(handle, state.image)) {
            return true;
        }
    }

    return false;
};

const assertSurfaceCanEndOrTransform = (surface: object): void => {
    if (isParticipatingInMapping(getHandle(surface))) {
        throw new TypeError("A mapped surface cannot be finished or have its device transform changed");
    }
};

const assertSurfaceCanMap = (handle: ExternalObject<Handle>): void => {
    if (isParticipatingInMapping(handle)) {
        throw new TypeError("The surface is already mapped");
    }
};

const releaseMappedImage = (state: MappedImageState): void => {
    if (!activeMappedImages.delete(state)) {
        return;
    }

    try {
        cairoSurfaceUnmapImage(state.source, state.image);
    } finally {
        endPointerBorrow(state.borrow);
    }
};

const registerMappedImage = (
    imageHandle: ExternalObject<Handle>,
    sourceHandle: ExternalObject<Handle>,
): void => {
    const state: MappedImageState = {
        borrow: clonePointerBorrow(imageHandle),
        image: cairoSurfaceReference(imageHandle) as ExternalObject<Handle>,
        source: sourceHandle,
        target: new WeakRef(imageHandle),
        token: {},
    };

    activeMappedImages.add(state);

    try {
        mappedImageReclaimer.register(imageHandle, state, state.token);
    } catch (error) {
        activeMappedImages.delete(state);
        throw error;
    }
};

const discardMappedImage = (
    sourceHandle: ExternalObject<Handle>,
    imageHandle: ExternalObject<Handle>,
): void => {
    try {
        cairoSurfaceUnmapImage(sourceHandle, imageHandle);
    } finally {
        endPointerBorrow(imageHandle);
    }
};

const unmapMappedImage = (
    sourceHandle: ExternalObject<Handle>,
    imageHandle: ExternalObject<Handle>,
): void => {
    const state = mappedImageStateFor(imageHandle);

    if (state === undefined || !handlesPointToSameMemory(sourceHandle, state.source)) {
        throw new TypeError("Expected an image mapped from this surface");
    }

    mappedImageReclaimer.unregister(state.token);
    releaseMappedImage(state);
};

export {
    assertSurfaceCanEndOrTransform,
    assertSurfaceCanMap,
    discardMappedImage,
    registerMappedImage,
    unmapMappedImage,
};
