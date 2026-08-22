import * as Gtk from "@gtkx/gi/gtk";
import { GtkShortcut, GtkShortcutController } from "@gtkx/jsx/gtk";
import { openTaskId } from "../navigation.js";
import { useStore } from "../store/index.js";
import { useRequestDeleteTask } from "./dialogs.js";

const shortcut = (accelerator: string, run: () => boolean) => (
    <GtkShortcut trigger={Gtk.ShortcutTrigger.parseString(accelerator)} action={Gtk.CallbackAction.new(run)} />
);

export const AppShortcuts = () => {
    const requestDeleteTask = useRequestDeleteTask();

    const toggleSearch = (): boolean => {
        const { searchMode, setSearchMode } = useStore.getState();
        setSearchMode(!searchMode);
        return true;
    };

    const deleteOpenTask = (): boolean => {
        const task = useStore.getState().tasks.find((candidate) => candidate.id === openTaskId());
        if (!task) return false;
        requestDeleteTask(task);
        return true;
    };

    return (
        <GtkShortcutController
            scope={Gtk.ShortcutScope.GLOBAL}
            shortcuts={
                <>
                    {shortcut("<Control>f", toggleSearch)}
                    {shortcut("Delete", deleteOpenTask)}
                </>
            }
        />
    );
};
