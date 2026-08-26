import { t } from "@gtkx/i18n";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { currentSelection, openTask } from "../navigation.js";
import { useStore } from "../store/index.js";
import { addListId } from "../store/selectors.js";

export const WindowActions = () => {
    const showDialog = useStore((state) => state.showDialog);

    const newTask = (): void => {
        const { lists, addTask } = useStore.getState();
        const selection = currentSelection();
        const id = addTask(addListId(selection, lists), t("New Task"));
        if (id) openTask(selection, id);
    };

    return (
        <>
            <GSimpleAction name="new" onActivate={newTask} />
            <GSimpleAction name="preferences" onActivate={() => showDialog("preferences")} />
            <GSimpleAction name="shortcuts" onActivate={() => showDialog("shortcuts")} />
            <GSimpleAction name="about" onActivate={() => showDialog("about")} />
        </>
    );
};
