import { t } from "@gtkx/i18n";
import { AdwToggle, AdwToggleGroup } from "@gtkx/jsx/adw";
import type { Filter } from "../types.js";
import { useStore } from "../store/index.js";

const TaskFilter = () => {
    const filter = useStore((state) => state.filter);
    const setFilter = useStore((state) => state.setFilter);

    return (
        <AdwToggleGroup
            activeName={filter}
            cssClasses={["round"]}
            onNotifyActiveName={(name) => {
                if (name !== null) {
                    setFilter(name as Filter);
                }
            }}
        >
            <AdwToggle name="all" label={t("All")} />
            <AdwToggle name="open" label={t("Open")} />
            <AdwToggle name="done" label={t("Done")} />
        </AdwToggleGroup>
    );
};

export {
    TaskFilter,
};
