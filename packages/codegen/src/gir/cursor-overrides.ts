type CursorParameterNames = {
    cursor: string;
    base: string;
    length: string;
    isMissingArrayType?: boolean;
};

const PARAMETERS_MISSING_ARRAY_EXTENT: Map<string, CursorParameterNames[]> = new Map([
    ["g_utf8_validate", [{ cursor: "end", base: "str", length: "max_len" }]],
    ["g_utf8_validate_len", [{ cursor: "end", base: "str", length: "max_len" }]],
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
