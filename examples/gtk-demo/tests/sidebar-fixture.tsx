import type { Demo } from "../src/demos/types.js";
import { Sidebar } from "../src/components/sidebar.js";
import { DemoProvider, useDemo } from "../src/context/demo-context.js";

const intro: Demo = { id: "intro", title: "GTK Demo", description: "Introduction", keywords: [] };
const standalone: Demo = { id: "stand", title: "Standalone", description: "No category", keywords: [] };

const button: Demo = {
    id: "button",
    title: "Buttons / Button",
    description: "Button description",
    keywords: ["click", "action"],
    component: () => null,
};

const expander: Demo = {
    id: "expander",
    title: "Buttons / Expander",
    description: "An expandable widget",
    keywords: ["disclosure"],
};

const fixedSlash: Demo = {
    id: "fixed",
    title: "Layout/Fixed",
    description: "Fixed layout",
    keywords: [],
};

const ConnectedSidebar = ({ isSearchActive }: { isSearchActive: boolean }) => {
    const { setSearchQuery } = useDemo();

    return <Sidebar isSearchActive={isSearchActive} onSearchChanged={setSearchQuery} />;
};

const drawSidebar = (demos: Demo[], isSearchActive = false) => (
    <DemoProvider demos={demos}>
        <ConnectedSidebar isSearchActive={isSearchActive} />
    </DemoProvider>
);

export { button, drawSidebar, expander, fixedSlash, intro, standalone };
