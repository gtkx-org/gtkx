import type * as Adw from "@gtkx/gi/adw";
import * as GLib from "@gtkx/gi/glib";
import { AdwApplication } from "@gtkx/jsx/adw";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { useState } from "react";
import { SettingsProvider } from "./components/settings.js";
import { Window } from "./components/window.js";
import { ALL_TASKS, openTask } from "./navigation.js";
import { useStore } from "./store/index.js";

export function App() {
    const [application, setApplication] = useState<Adw.Application | null>(null);

    return (
        <AdwApplication
            ref={setApplication}
            onActivate={() => application?.getActiveWindow()?.present()}
            actionAccels={[
                { detailedActionName: "win.new", accels: ["<Control>n"] },
                { detailedActionName: "win.preferences", accels: ["<Control>comma"] },
                { detailedActionName: "win.shortcuts", accels: ["<Control>question"] },
            ]}
            actions={
                <>
                    <GSimpleAction
                        name="complete-task"
                        parameterType={GLib.VariantType.new("s")}
                        onActivate={(parameter) => {
                            useStore.getState().setDone((parameter as GLib.Variant).getString()[0], true);
                        }}
                    />
                    <GSimpleAction
                        name="open-task"
                        parameterType={GLib.VariantType.new("s")}
                        onActivate={(parameter) => {
                            openTask(ALL_TASKS, (parameter as GLib.Variant).getString()[0]);
                            application?.activate();
                        }}
                    />
                </>
            }
        >
            <SettingsProvider>
                <Window />
            </SettingsProvider>
        </AdwApplication>
    );
}
