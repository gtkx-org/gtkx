import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const GlShadersOverviewDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="GL & Shaders" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About GL Rendering" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GTK4 uses OpenGL for hardware-accelerated rendering by default. The GtkGLArea widget provides a dedicated OpenGL rendering surface, while GskGLShader enables custom GLSL fragment shaders."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Available Components" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={`• GtkGLArea - OpenGL rendering widget with render signal
• GskGLShader - GLSL fragment shader compilation
• GskShaderNode - Shader-based render nodes
• GdkGLContext - OpenGL context management`}
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Shader Capabilities" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={`• Custom GLSL fragment shaders
• Up to 4 texture inputs
• Uniform variable support
• Automatic GPU acceleration
• Integration with GTK's render pipeline`}
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Use Cases" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={`• Custom visual effects (blur, glow, distortion)
• Real-time graphics applications
• 3D rendering and visualization
• Game graphics
• <GtkImage processing filters`}
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Current Status" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkGLArea JSX component and GskGLShader FFI bindings are available. The render signal provides a GdkGLContext for OpenGL operations. Full GL bindings integration is in development."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>
        </GtkBox>
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
