const FUNCTIONS_MISSING_FINISH_FUNC: Map<string, string> = new Map([
    /* TODO: Remove once supported GLib GIR includes the finish-func annotation added in 2.90.0.
     * https://github.com/gtkx-org/gtkx/issues/754
     */
    ["g_file_replace_contents_bytes_async", "replace_contents_finish"],
]);

export { FUNCTIONS_MISSING_FINISH_FUNC };
