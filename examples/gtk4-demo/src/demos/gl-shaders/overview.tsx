import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const GlShadersOverviewDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label label="GL & Shaders" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="About GL Rendering" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="GTK4 uses OpenGL for hardware-accelerated rendering by default. The GtkGLArea widget provides a dedicated OpenGL rendering surface, while GskGLShader enables custom GLSL fragment shaders."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Available Components" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="• GtkGLArea - OpenGL rendering widget with render signal\n• GskGLShader - GLSL fragment shader compilation\n• GskShaderNode - Shader-based render nodes\n• GdkGLContext - OpenGL context management"
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Shader Capabilities" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="• Custom GLSL fragment shaders\n• Up to 4 texture inputs\n• Uniform variable support\n• Automatic GPU acceleration\n• Integration with GTK's render pipeline"
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Use Cases" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="• Custom visual effects (blur, glow, distortion)\n• Real-time graphics applications\n• 3D rendering and visualization\n• Game graphics\n• Image processing filters"
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Current Status" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="GtkGLArea JSX component and GskGLShader FFI bindings are available. The render signal provides a GdkGLContext for OpenGL operations. Full GL bindings integration is in development."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
    );
};

export const glShadersOverviewDemo: Demo = {
    id: "gl-shaders-overview",
    title: "GL & Shaders Overview",
    description: "Hardware-accelerated rendering with OpenGL shaders.",
    keywords: ["opengl", "gl", "shaders", "glsl", "gpu", "hardware"],
    component: GlShadersOverviewDemo,
    sourcePath: getSourcePath(import.meta.url, "overview.tsx"),
};
