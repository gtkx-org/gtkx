type CursorParameterNames = {
    cursor: string;
    base: string;
    length: string;
    isMissingArrayType?: boolean;
};

const PARAMETERS_MISSING_ARRAY_EXTENT: Map<string, CursorParameterNames[]> = new Map([
    /* TODO: Keep both bounded cursors until GLib metadata describes their remaining input extent.
     * https://github.com/gtkx-org/gtkx/issues/756
     */
    ["g_utf8_validate", [{ cursor: "end", base: "str", length: "max_len" }]],
    ["g_utf8_validate_len", [{ cursor: "end", base: "str", length: "max_len" }]],
    /* TODO: Keep bounded borrowed cursors until HarfBuzz metadata describes the input lifetime and remaining
     * extent.
     * https://github.com/gtkx-org/gtkx/issues/735
     */
    [
        "hb_buffer_deserialize_glyphs",
        [{ cursor: "end_ptr", base: "buf", length: "buf_len", isMissingArrayType: true }],
    ],
    [
        "hb_buffer_deserialize_unicode",
        [{ cursor: "end_ptr", base: "buf", length: "buf_len", isMissingArrayType: true }],
    ],
]);

export { PARAMETERS_MISSING_ARRAY_EXTENT, type CursorParameterNames };
