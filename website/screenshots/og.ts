/**
 * Generates the social-sharing imagery from the site's design tokens and the
 * captured Notes-app screenshot: the Open Graph card (`public/og/og-home.png`,
 * 1200x630), the GitHub social preview (`.github/social-preview.png`,
 * 1280x640), and the hero video end card (`screenshots/out/hero-end-card.png`,
 * 1920x1080). Typography uses the vendored Red Hat TTFs (OFL) because satori
 * cannot consume the site's woff2 files.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import satori from "satori";
import sharp from "sharp";

const SCREENSHOTS_DIR = import.meta.dirname;
const WEBSITE_DIR = resolve(SCREENSHOTS_DIR, "..");
const REPO_ROOT = resolve(WEBSITE_DIR, "..");

const INK = "#15161b";
const PAPER = "#faf8f5";
const CRIMSON = "#de3d4e";
const DIM = "#a0a7b3";

const fonts = [
    {
        name: "Red Hat Display",
        data: readFileSync(join(SCREENSHOTS_DIR, "assets/fonts/red-hat-display-black.ttf")),
        weight: 900 as const,
        style: "normal" as const,
    },
    {
        name: "Red Hat Display",
        data: readFileSync(join(SCREENSHOTS_DIR, "assets/fonts/red-hat-display-bold.ttf")),
        weight: 700 as const,
        style: "normal" as const,
    },
    {
        name: "Red Hat Text",
        data: readFileSync(join(SCREENSHOTS_DIR, "assets/fonts/red-hat-text-regular.ttf")),
        weight: 400 as const,
        style: "normal" as const,
    },
];

const logoDataUri = `data:image/svg+xml;base64,${readFileSync(join(WEBSITE_DIR, "public/logo.svg")).toString("base64")}`;

type Node = { type: string; props: Record<string, unknown> };

const node = (type: string, style: Record<string, unknown>, children?: Node[] | string): Node => ({
    type,
    props: { style, ...(children !== undefined ? { children } : {}) },
});

const image = (src: string, style: Record<string, unknown>): Node => ({ type: "img", props: { src, style } });

interface CardLayout {
    width: number;
    height: number;
    padding: number;
    logoSize: number;
    brandSize: number;
    headlineSize: number;
    headlineWidth: number;
    subSize: number;
    centered: boolean;
}

const card = (layout: CardLayout): Node =>
    node(
        "div",
        {
            width: layout.width,
            height: layout.height,
            display: "flex",
            flexDirection: "column",
            justifyContent: layout.centered ? "center" : "flex-start",
            alignItems: layout.centered ? "center" : "flex-start",
            padding: layout.padding,
            backgroundColor: INK,
            backgroundImage: `radial-gradient(circle at 85% 10%, rgba(200, 16, 46, 0.28), rgba(200, 16, 46, 0) 55%)`,
            fontFamily: "Red Hat Display",
        },
        [
            node(
                "div",
                {
                    display: "flex",
                    alignItems: "center",
                    gap: 20,
                    marginBottom: layout.centered ? 36 : 44,
                },
                [
                    image(logoDataUri, { width: layout.logoSize, height: layout.logoSize }),
                    node(
                        "div",
                        {
                            fontSize: layout.brandSize,
                            fontWeight: 900,
                            color: PAPER,
                            letterSpacing: "-0.02em",
                        },
                        "GTKX",
                    ),
                ],
            ),
            node(
                "div",
                {
                    display: "flex",
                    flexWrap: "wrap",
                    width: layout.headlineWidth,
                    fontSize: layout.headlineSize,
                    fontWeight: 900,
                    lineHeight: 1.12,
                    letterSpacing: "-0.01em",
                    color: PAPER,
                    textAlign: layout.centered ? "center" : "left",
                    justifyContent: layout.centered ? "center" : "flex-start",
                },
                [
                    node("span", { color: PAPER, marginRight: 12 }, "Native Linux application development"),
                    node("span", { color: CRIMSON }, "for the modern age"),
                ],
            ),
            node(
                "div",
                {
                    marginTop: 28,
                    width: layout.headlineWidth,
                    fontSize: layout.subSize,
                    fontFamily: "Red Hat Text",
                    lineHeight: 1.5,
                    color: DIM,
                    textAlign: layout.centered ? "center" : "left",
                },
                "React 19 renders to real GTK4 and Libadwaita widgets on Node.js — no Electron, no WebView.",
            ),
            node(
                "div",
                {
                    marginTop: "auto",
                    fontSize: Math.round(layout.subSize * 0.95),
                    fontWeight: 700,
                    color: CRIMSON,
                },
                "gtkx.dev",
            ),
        ],
    );

const renderCard = async (layout: CardLayout): Promise<Buffer> => {
    const svg = await satori(card(layout) as Parameters<typeof satori>[0], {
        width: layout.width,
        height: layout.height,
        fonts,
    });
    return sharp(Buffer.from(svg)).png().toBuffer();
};

const roundedShadowedShot = async (source: string, width: number): Promise<{ data: Buffer; height: number }> => {
    const resized = await sharp(source).resize({ width }).png().toBuffer();
    const { height = 0 } = await sharp(resized).metadata();
    const margin = 28;
    const shadow = Buffer.from(
        `<svg width="${width + margin * 2}" height="${height + margin * 2}"><filter id="b"><feGaussianBlur stdDeviation="10"/></filter><rect x="${margin}" y="${margin + 6}" width="${width}" height="${height}" rx="16" fill="black" opacity="0.55" filter="url(#b)"/></svg>`,
    );
    const composed = await sharp({
        create: { width: width + margin * 2, height: height + margin * 2, channels: 4, background: "#00000000" },
    })
        .composite([
            { input: shadow, left: 0, top: 0 },
            { input: resized, left: margin, top: margin },
        ])
        .png()
        .toBuffer();
    return { data: composed, height: height + margin * 2 };
};

const composeWithScreenshot = async (base: Buffer, layout: CardLayout, shotWidth: number): Promise<Buffer> => {
    const shotSource = join(WEBSITE_DIR, "public/media/notes-dark.webp");
    const shot = await roundedShadowedShot(shotSource, shotWidth);
    const left = layout.width - shotWidth - Math.round(layout.padding * 0.9);
    const top = Math.round((layout.height - shot.height) / 2) + Math.round(layout.height * 0.12);
    return sharp(base)
        .composite([{ input: shot.data, left, top: Math.min(top, layout.height - shot.height) }])
        .png()
        .toBuffer();
};

const ogLayout: CardLayout = {
    width: 1200,
    height: 630,
    padding: 64,
    logoSize: 72,
    brandSize: 46,
    headlineSize: 50,
    headlineWidth: 660,
    subSize: 22,
    centered: false,
};

const socialLayout: CardLayout = { ...ogLayout, width: 1280, height: 640, headlineWidth: 700 };

const endCardLayout: CardLayout = {
    width: 1920,
    height: 1080,
    padding: 120,
    logoSize: 120,
    brandSize: 72,
    headlineSize: 84,
    headlineWidth: 1400,
    subSize: 32,
    centered: true,
};

mkdirSync(join(WEBSITE_DIR, "public/og"), { recursive: true });
mkdirSync(join(SCREENSHOTS_DIR, "out"), { recursive: true });

const og = await composeWithScreenshot(await renderCard(ogLayout), ogLayout, 420);
writeFileSync(join(WEBSITE_DIR, "public/og/og-home.png"), og);
console.log("public/og/og-home.png");

const social = await composeWithScreenshot(await renderCard(socialLayout), socialLayout, 440);
writeFileSync(join(REPO_ROOT, ".github/social-preview.png"), social);
console.log(".github/social-preview.png");

writeFileSync(join(SCREENSHOTS_DIR, "out/hero-end-card.png"), await renderCard(endCardLayout));
console.log("screenshots/out/hero-end-card.png");
