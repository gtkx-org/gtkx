import { GtkDrawingArea } from "@gtkx/jsx/gtk";

export function Circle() {
    return (
        <GtkDrawingArea
            contentWidth={200}
            contentHeight={120}
            drawFunc={(_area, cr, width, height) => {
                cr.setSourceRgb(0.2, 0.4, 0.9);
                cr.arc(
                    width / 2,
                    height / 2,
                    Math.min(width, height) / 3,
                    0,
                    2 * Math.PI,
                );
                cr.fill();
            }}
        />
    );
}
