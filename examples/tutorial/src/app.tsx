import * as GLib from "@gtkx/gi/glib";
import { AdwApplication } from "@gtkx/jsx/adw";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { Window } from "./components/window.js";
import { ALL_TASKS, openTask } from "./navigation.js";
import { useStore } from "./store/index.js";

export function App() {
    return (
        <AdwApplication
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
                            if (parameter) useStore.getState().setDone(parameter.getString()[0], true);
                        }}
                    />
                    <GSimpleAction
                        name="open-task"
                        parameterType={GLib.VariantType.new("s")}
                        onActivate={(parameter) => {
                            if (!parameter) return;
                            openTask(ALL_TASKS, parameter.getString()[0]);
                        }}
                    />
                </>
            }
        >
            <Window />
        </AdwApplication>
    );
}
