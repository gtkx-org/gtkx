import { t } from "@gtkx/i18n";
import { AdwToggle, AdwToggleGroup } from "@gtkx/jsx/adw";
import { useStore } from "../store/index.js";

export const TaskFilter = () => {
    const filter = useStore((state) => state.filter);
    const setFilter = useStore((state) => state.setFilter);

    return (
        <AdwToggleGroup
            activeName={filter}
            cssClasses={["round"]}
            onNotifyActiveName={(name) => {
                if (name === "all" || name === "open" || name === "done") setFilter(name);
            }}
        >
            <AdwToggle name="all" label={t("All")} />
            <AdwToggle name="open" label={t("Open")} />
            <AdwToggle name="done" label={t("Done")} />
        </AdwToggleGroup>
    );
};
