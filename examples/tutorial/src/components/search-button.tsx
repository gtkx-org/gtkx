import { t } from "@gtkx/i18n";
import { GtkButton } from "@gtkx/jsx/gtk";
import { useStore } from "../store/index.js";

export const SearchButton = () => {
    const searchMode = useStore((state) => state.searchMode);
    const setSearchMode = useStore((state) => state.setSearchMode);

    return (
        <GtkButton
            iconName="system-search-symbolic"
            tooltipText={t("Search (Ctrl+F)")}
            onClicked={() => setSearchMode(!searchMode)}
        />
    );
};
