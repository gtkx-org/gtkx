import { t } from "@gtkx/i18n";
import { AdwWindowTitle } from "@gtkx/jsx/adw";
import { useStore } from "../store/index.js";

export const TaskTitle = ({ id }: { id: string }) => {
    const title = useStore((state) => state.tasks.find((task) => task.id === id)?.title);

    return <AdwWindowTitle title={title ?? t("Task")} />;
};
