import * as Gtk from "@gtkx/gi/gtk";
import { AdwApplication, AdwApplicationWindow, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot, quit } from "@gtkx/react";
import process from "node:process";
import { useEffect, useRef, useState } from "react";
import { Banner } from "./banner.js";
import { getJavascriptRenders, JavascriptBanner } from "./javascript-banner.mjs";
import { label } from "./label.js";
import { getTypescriptRenders, TypescriptBanner } from "./typescript-banner.mjs";

const ExtensionBanners = ({ revision }: { revision: number }) => {
    "use no memo";

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>
            <JavascriptBanner />
            <TypescriptBanner />
            <GtkLabel label={String(revision)} />
        </GtkBox>
    );
};

const App = () => {
    const [count, setCount] = useState(0);
    const counter = useRef<Gtk.Label>(null);
    const banner = useRef<Gtk.Label>(null);
    const button = useRef<Gtk.Button>(null);
    const rows = [label.text, "first-build", String(count)];

    useEffect(() => {
        const activate = () => {
            button.current?.activate();
        };
        process.on("message", activate);

        return () => {
            process.off("message", activate);
        };
    }, []);

    useEffect(() => {
        process.send?.({
            counter: counter.current?.getLabel(),
            banner: banner.current?.getLabel(),
            javascriptRenders: getJavascriptRenders(),
            typescriptRenders: getTypescriptRenders(),
        });
        if (count === 2) {
            quit();
        }
    }, [count]);

    return (
        <AdwApplicationWindow defaultWidth={320} defaultHeight={200}>
            <AdwToolbarView topBar={<AdwHeaderBar />}>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                    <GtkLabel ref={counter} label={rows.join("-")} />
                    <Banner ref={banner} text="banner" />
                    <ExtensionBanners revision={count} />
                    <GtkButton
                        ref={button}
                        label="Increment"
                        onClicked={() => {
                            setCount(count + 1);
                        }}
                    />
                </GtkBox>
            </AdwToolbarView>
        </AdwApplicationWindow>
    );
};

process.channel?.unref();
createRoot().render(<AdwApplication><App /></AdwApplication>);
