import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwApplicationWindow, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import { GtkBox } from "@gtkx/jsx/gtk";
import { cleanup, render, screen } from "@gtkx/testing";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, it } from "vitest";
import { GALLERY_ENTRIES, type GalleryEntry } from "./gallery/manifest.js";
import { setTheme, THEMES } from "./theme.js";

const OUT_DIR = resolve(import.meta.dirname, "out/gallery");
const SCALE = 2;

mkdirSync(OUT_DIR, { recursive: true });

const fixtureModules = import.meta.glob<{ Demo: ComponentType }>("./gallery/fixtures/*.tsx", { eager: true });

const fixtureFor = (slug: string): ComponentType => {
    const module = fixtureModules[`./gallery/fixtures/${slug}.tsx`];
    if (!module) throw new Error(`No gallery fixture for slug "${slug}"`);
    return module.Demo;
};

const Shell = ({ entry, children }: { entry: GalleryEntry; children: ReactNode }) => (
    <AdwApplicationWindow title={entry.title} defaultWidth={entry.width} defaultHeight={entry.height}>
        <AdwToolbarView addTopBar={<AdwHeaderBar />}>
            {entry.fill ? (
                children
            ) : (
                <GtkBox
                    halign={Gtk.Align.CENTER}
                    valign={Gtk.Align.CENTER}
                    vexpand
                    marginTop={24}
                    marginBottom={24}
                    marginStart={24}
                    marginEnd={24}
                >
                    {children}
                </GtkBox>
            )}
        </AdwToolbarView>
    </AdwApplicationWindow>
);

describe("Gallery Screenshots", () => {
    afterEach(async () => {
        await cleanup();
    });

    for (const theme of THEMES) {
        for (const entry of GALLERY_ENTRIES) {
            it(`captures ${entry.slug} (${theme})`, async () => {
                const Demo = fixtureFor(entry.slug);
                setTheme(theme);
                await render(
                    <Shell entry={entry}>
                        <Demo />
                    </Shell>,
                    { wrapper: false },
                );
                const result = await screen.screenshot(undefined, { scale: SCALE });
                writeFileSync(resolve(OUT_DIR, `${entry.slug}-${theme}.png`), Buffer.from(result.data, "base64"));
            });
        }
    }
});
