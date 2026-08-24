import * as GLib from "@gtkx/gi/glib";
import { AdwApplication } from "@gtkx/jsx/adw";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { useCallback, useState } from "react";
import { Window } from "./components/window.js";
import { ALL_TASKS, type OpenTaskRequest } from "./navigation.js";
import { useStore } from "./store/index.js";

export function App() {
    const [openTaskRequest, setOpenTaskRequest] = useState<OpenTaskRequest | null>(null);
    const requestOpenTask = useCallback((request: OpenTaskRequest): void => {
        setOpenTaskRequest(request);
    }, []);
    const handleOpenTaskRequest = useCallback((handled: OpenTaskRequest): void => {
        setOpenTaskRequest((current) => (current === handled ? null : current));
    }, []);

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
                            requestOpenTask({ selection: ALL_TASKS, id: parameter.getString()[0] });
                        }}
                    />
                </>
            }
        >
            <Window
                openTaskRequest={openTaskRequest}
                onOpenTaskRequest={requestOpenTask}
                onOpenTaskRequestHandled={handleOpenTaskRequest}
            />
        </AdwApplication>
    );
}
