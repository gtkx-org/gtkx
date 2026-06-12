/**
 * Converts the lossless capture masters under `screenshots/out/` into the
 * WebP assets the documentation and website serve.
 *
 * Widget-snapshot masters arrive as RGBA window captures with native rounded
 * corners and pass through unchanged. Display-grab masters (full-screen X11
 * captures, no alpha) are trimmed to the window bounds against the black root
 * window and given an Adwaita-radius rounded-corner alpha mask so every
 * published asset has a uniform window silhouette.
 *
 * Each asset is encoded losslessly when that fits the size budget and
 * near-losslessly otherwise; any output above the hard budget fails the run.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import sharp from "sharp";

const SCREENSHOTS_DIR = import.meta.dirname;
const OUT_DIR = join(SCREENSHOTS_DIR, "out");

const TARGETS = [
    { masters: join(OUT_DIR, "tutorial"), destination: resolve(SCREENSHOTS_DIR, "../docs/tutorial/images") },
    { masters: join(OUT_DIR, "gallery"), destination: resolve(SCREENSHOTS_DIR, "../docs/gallery/images") },
    { masters: join(OUT_DIR, "showcase"), destination: resolve(SCREENSHOTS_DIR, "../public/media") },
];

const WINDOW_CORNER_RADIUS_PX = 24;
const TRIM_THRESHOLD = 12;
const LOSSLESS_BUDGET_BYTES = 150 * 1024;
const HARD_BUDGET_BYTES = 400 * 1024;

const roundedCornerMask = (width: number, height: number): Buffer =>
    Buffer.from(
        `<svg width="${width}" height="${height}"><rect width="${width}" height="${height}" rx="${WINDOW_CORNER_RADIUS_PX}" ry="${WINDOW_CORNER_RADIUS_PX}"/></svg>`,
    );

const normalizeDisplayGrab = async (master: Buffer): Promise<Buffer> => {
    const trimmed = await sharp(master)
        .trim({ background: "#000000", threshold: TRIM_THRESHOLD })
        .ensureAlpha()
        .toBuffer();
    const { width, height } = await sharp(trimmed).metadata();
    return sharp(trimmed)
        .composite([{ input: roundedCornerMask(width, height), blend: "dest-in" }])
        .png()
        .toBuffer();
};

const encodeWebp = async (master: Buffer): Promise<Buffer> => {
    const lossless = await sharp(master).webp({ lossless: true, effort: 6 }).toBuffer();
    if (lossless.byteLength <= LOSSLESS_BUDGET_BYTES) return lossless;
    return sharp(master).webp({ nearLossless: true, quality: 80, effort: 6 }).toBuffer();
};

const processMaster = async (masterPath: string, destinationDir: string): Promise<string> => {
    const master = await sharp(masterPath).toBuffer({ resolveWithObject: true });
    const normalized = master.info.channels === 4 ? master.data : await normalizeDisplayGrab(master.data);
    const encoded = await encodeWebp(normalized);
    const name = `${basename(masterPath, ".png")}.webp`;

    if (encoded.byteLength > HARD_BUDGET_BYTES) {
        throw new Error(
            `${name} is ${Math.round(encoded.byteLength / 1024)}KB, over the ${HARD_BUDGET_BYTES / 1024}KB budget`,
        );
    }

    writeFileSync(join(destinationDir, name), encoded);
    return `${name} (${Math.round(encoded.byteLength / 1024)}KB)`;
};

for (const { masters, destination } of TARGETS) {
    if (!existsSync(masters)) continue;
    mkdirSync(destination, { recursive: true });
    const files = readdirSync(masters)
        .filter((file) => file.endsWith(".png"))
        .sort();
    for (const file of files) {
        const summary = await processMaster(join(masters, file), destination);
        console.log(`${basename(destination)}/${summary}`);
    }
}
