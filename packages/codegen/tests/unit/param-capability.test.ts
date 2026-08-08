import { describe, expect, it } from "vitest";
import type { GirFunction } from "../../src/gir/function.js";
import { hasUnmarshalableParam } from "../../src/analysis/param-capability.js";
import { ModuleContext } from "../../src/writer/context.js";
import { library, locateCallable } from "../helpers/library.js";

type Located = { context: ModuleContext; callable: GirFunction };

const REJECTED: string[] = [
    "g_option_context_parse",
    "g_option_context_parse_strv",
    "g_prefix_error_literal",
    "g_enum_complete_type_info",
    "g_flags_complete_type_info",
    "g_base64_encode_step",
    "g_base64_encode_close",
    "graphene_box_get_vertices",
    "graphene_matrix_to_float",
    "gdk_texture_downloader_download_bytes_with_planes",
    "pango_scan_int",
    "pango_glyph_item_get_logical_widths",
    "pango_glyph_string_get_logical_widths",
    "pango_tab_array_get_tabs",
    "hb_tag_to_string",
    "hb_face_get_table_tags",
    "hb_buffer_serialize_glyphs",
    "hb_font_get_glyph_advances_for_direction",
];

const ACCEPTED: string[] = [
    "g_shell_parse_argv",
    "g_base64_decode_inplace",
    "g_filename_from_uri",
    "g_unichar_to_utf8",
    "g_propagate_error",
    "g_set_error_literal",
    "g_settings_backend_flatten_tree",
    "g_tls_password_get_value",
    "g_file_get_contents",
    "g_spawn_command_line_sync",
    "pango_extents_to_pixels",
    "pango_layout_get_log_attrs",
    "pango_matrix_transform_rectangle",
    "gdk_display_map_keyval",
    "gdk_display_map_keycode",
    "gtk_gesture_stylus_get_backlog",
    "gtk_gesture_stylus_get_axes",
];

const locate = (cIdentifier: string): Located => {
    const located = locateCallable(cIdentifier);

    if (located === undefined) {
        throw new Error(`${cIdentifier} was not found in any loaded namespace`);
    }

    return { context: new ModuleContext(located.namespace, library), callable: located.callable };
};

const isRejected = (cIdentifier: string): boolean => {
    const { context, callable } = locate(cIdentifier);

    return hasUnmarshalableParam(context, callable);
};

describe("hasUnmarshalableParam", () => {
    it.each(REJECTED)("rejects %s", (cIdentifier) => {
        expect(isRejected(cIdentifier)).toBe(true);
    });

    it.each(ACCEPTED)("accepts %s", (cIdentifier) => {
        expect(isRejected(cIdentifier)).toBe(false);
    });

    it("ignores the GError a throwing callable carries, because it is not a parameter", () => {
        const { callable } = locate("g_key_file_load_from_file");
        expect(callable.throws).toBe(true);
        expect(callable.parameters.some((parameter) => parameter.direction !== "in")).toBe(false);
        expect(isRejected("g_key_file_load_from_file")).toBe(false);
    });
});
