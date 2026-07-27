import * as Gdk from "@gtkx/gi/gdk";

const buildRgba = (red: number, green: number, blue: number, alpha: number): Gdk.RGBA => {
    const rgba = new Gdk.RGBA();
    rgba.red = red;
    rgba.green = green;
    rgba.blue = blue;
    rgba.alpha = alpha;

    return rgba;
};

export { buildRgba };
