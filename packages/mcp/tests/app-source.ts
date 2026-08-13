/* eslint-disable unicorn/no-incorrect-template-string-interpolation -- the JSX braces below belong to the app source */
const APP_SOURCE = `import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkApplication, GtkApplicationWindow, GtkBox, GtkButton, GtkEntry, GtkLabel } from "@gtkx/jsx/gtk";
import { createRoot } from "@gtkx/react";
import { useState } from "react";

const WIDE_CHILDREN = 60;
const CHAIN_DEPTH = 10;

const TREE_ITEMS = [
    { id: "alpha", value: "alpha", children: [{ id: "alpha-child", value: "alpha-child" }] },
    { id: "beta", value: "beta" },
];

const Chain = ({ level }) =>
    level <= 1 ? <GtkLabel label="deep" /> : <GtkBox><Chain level={level - 1} /></GtkBox>;

const Wide = () => (
    <GtkBox name="wide">
        {Array.from({ length: WIDE_CHILDREN }, (unused, index) => <GtkLabel key={index} label={"item " + index} />)}
    </GtkBox>
);

const App = () => {
    const [count, setCount] = useState(0);
    const [expandedIds, setExpandedIds] = useState([]);

    return (
        <GtkApplication>
            <GtkApplicationWindow title="Probe">
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkLabel label={"clicks: " + count} cssClasses={["dim-label", "heading"]} />
                    <GtkButton label="Press me" onClicked={() => setCount((value) => value + 1)} />
                    <GtkEntry placeholderText="Type here" inputHints={Gtk.InputHints.SPELLCHECK} />
                    <GtkBox name="chain"><Chain level={CHAIN_DEPTH} /></GtkBox>
                    <Wide />
                    <ListView
                        items={TREE_ITEMS}
                        expandedIds={expandedIds}
                        onExpandedChange={setExpandedIds}
                        renderItem={({ item }) => <GtkLabel label={item} />}
                    />
                </GtkBox>
            </GtkApplicationWindow>
        </GtkApplication>
    );
};

createRoot().render(<App />);
`;

export { APP_SOURCE };
