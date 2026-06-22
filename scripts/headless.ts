export const HEADLESS_RENDER_ENV = {
    GDK_BACKEND: "wayland",
    GSK_RENDERER: "cairo",
    LIBGL_ALWAYS_SOFTWARE: "1",
    GDK_DISABLE: "vulkan",
};

export function wlheadless(command: string, args: string[]): [string, string[]] {
    return ["wlheadless-run", ["-c", "weston", "--", command, ...args]];
}
