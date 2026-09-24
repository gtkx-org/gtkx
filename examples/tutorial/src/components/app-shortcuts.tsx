import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkCallbackAction,
    GtkShortcut,
    GtkShortcutController,
    GtkShortcutTrigger,
} from "@gtkx/jsx/gtk";
import { openTaskId } from "../navigation.js";
import { useStore } from "../store/index.js";
import { useRequestDeleteTask } from "./dialogs.js";

const shortcut = (accelerator: string, didRun: () => boolean) => (
    <GtkShortcut
        trigger={<GtkShortcutTrigger accelerator={accelerator} />}
        action={<GtkCallbackAction callback={didRun} />}
    />
);

const didToggleSearch = (): boolean => {
    const { searchMode, setSearchMode } = useStore.getState();
    setSearchMode(!searchMode);

    return true;
};

const AppShortcuts = () => {
    const requestDeleteTask = useRequestDeleteTask();

    const didDeleteOpenTask = (): boolean => {
        const task = useStore.getState().tasks.find((candidate) => candidate.id === openTaskId());
        if (!task) {
            return false;
        }
        requestDeleteTask(task);

        return true;
    };

    return (
        <GtkShortcutController
            scope={Gtk.ShortcutScope.GLOBAL}
            shortcuts={(
                <>
                    {shortcut("<Control>f", didToggleSearch)}
                    {shortcut("Delete", didDeleteOpenTask)}
                </>
            )}
        />
    );
};

export {
    AppShortcuts,
};
