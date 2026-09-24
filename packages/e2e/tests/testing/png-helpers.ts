import * as Gdk from "@gtkx/gi/gdk";
import * as GLib from "@gtkx/gi/glib";

type DecodedPng = {
    width: number;
    height: number;
    pixels: Uint8Array;
};

const RGBA_CHANNELS = 4;

const textureFromPng = (base64Data: string): Gdk.Texture =>
    Gdk.Texture.newFromBytes(GLib.Bytes.new(Buffer.from(base64Data, "base64")));

const decodePngSize = (base64Data: string): { width: number; height: number } => {
    const texture = textureFromPng(base64Data);

    return { width: texture.getWidth(), height: texture.getHeight() };
};

const decodePng = (base64Data: string): DecodedPng => {
    const texture = textureFromPng(base64Data);
    const downloader = Gdk.TextureDownloader.new(texture);
    downloader.setFormat(Gdk.MemoryFormat.R8G8B8A8);
    const [downloaded, stride] = downloader.downloadBytes();
    const source = downloaded.getData();

    if (source === null) {
        throw new Error("GDK returned no decoded PNG pixels");
    }

    const width = texture.getWidth();
    const height = texture.getHeight();
    const rowLength = width * RGBA_CHANNELS;
    const pixels = new Uint8Array(rowLength * height);

    for (let row = 0; row < height; row += 1) {
        pixels.set(source.subarray(row * stride, row * stride + rowLength), row * rowLength);
    }

    return { width, height, pixels };
};

export { decodePng, decodePngSize };
