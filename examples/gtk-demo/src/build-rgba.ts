import * as Gdk from "@gtkx/gi/gdk";

const buildRgba = (red: number, green: number, blue: number, alpha: number): Gdk.RGBA =>
    new Gdk.RGBA({ red, green, blue, alpha });

export { buildRgba };
