type CursorParameterNames = {
    cursor: string;
    base: string;
    length: string;
};

const PARAMETERS_MISSING_ARRAY_EXTENT: Map<string, CursorParameterNames[]> = new Map([
    ["g_utf8_validate", [{ cursor: "end", base: "str", length: "max_len" }]],
    ["g_utf8_validate_len", [{ cursor: "end", base: "str", length: "max_len" }]],
]);

export { PARAMETERS_MISSING_ARRAY_EXTENT, type CursorParameterNames };
