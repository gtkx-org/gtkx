import type { RecordConverterOptions } from "./native.js";
import { functionResolver } from "./descriptor-lifecycle.js";

const cairoPathConverter = (sharedLibrary: string): RecordConverterOptions => ({
    kind: "cairo-path",
    surfaceCreate: functionResolver(sharedLibrary, "cairo_image_surface_create"),
    surfaceDestroy: functionResolver(sharedLibrary, "cairo_surface_destroy"),
    contextCreate: functionResolver(sharedLibrary, "cairo_create"),
    contextDestroy: functionResolver(sharedLibrary, "cairo_destroy"),
    appendPath: functionResolver(sharedLibrary, "cairo_append_path"),
    copyPath: functionResolver(sharedLibrary, "cairo_copy_path"),
    contextStatus: functionResolver(sharedLibrary, "cairo_status"),
    pathDestroy: functionResolver(sharedLibrary, "cairo_path_destroy"),
});

export { cairoPathConverter };
