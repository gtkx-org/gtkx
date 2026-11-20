import * as Gdk from "@gtkx/gi/gdk";
import * as gl from "@gtkx/gl";
import { GtkGLArea } from "@gtkx/jsx/gtk";

export const ColorArea = () => (
    <GtkGLArea
        hexpand
        vexpand
        onRender={() => {
            gl.clearColor(0.5, 0.5, 0.5, 1);
            gl.clear(gl.COLOR_BUFFER_BIT);
            return Gdk.EVENT_STOP;
        }}
    />
);
