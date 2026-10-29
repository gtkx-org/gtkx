import * as Pango from "@gtkx/gi/pango";
import { AdwClamp, AdwHeaderBar, AdwStatusPage, AdwToolbarView, AdwWrapBox } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { useRef, useState } from "react";

const words = (
    "Lorem Ipsum Dolor Sit Amet Consectetur Adipiscing Elit Sed Do Eiusmod " +
    "Tempor Incididunt Ut Labore Et Dolore Magnam Aliquam Quaerat Voluptatem " +
    "Ut Enim Aeque Doleamus Animo Cum Corpore Dolemus Fieri Tamen Permagna " +
    "Accessio Potest Si Aliquod Aeternum Ullus Investigandi Veri Nisi " +
    "Inveneris Et Quaerendi Defatigatio Turpis Est Cum Esset Accusata Et " +
    "Vituperata Ab Hortensio Qui Liber Cum Et Mortem Contemnit Qua Qui Est " +
    "Imbutus Quietus Esse Numquam Potest Praeterea Bona Praeterita Grata " +
    "Recordatione Renovata Delectant Est Autem Situm In"
).split(" ");

export const WrapBoxPage = () => {
    const [tags, setTags] = useState(() => words.slice(0, 10).map((label, id) => ({ id, label })));
    const nextId = useRef(10);

    const addTag = () => {
        const id = nextId.current;
        nextId.current += 1;
        const label = words[id % words.length];
        if (label !== undefined) setTags((current) => [...current, { id, label }]);
    };

    return (
        <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
            <AdwStatusPage
                iconName="widget-wrap-box-symbolic"
                title="Wrap Box"
                description="A box-like widget that can wrap into multiple lines."
            >
                <AdwClamp>
                    <AdwWrapBox lineSpacing={6} childSpacing={6}>
                        {tags.map(({ id, label }) => (
                            <GtkBox key={id} cssClasses={["tag"]} hexpand={false}>
                                <GtkLabel label={label} xalign={0} ellipsize={Pango.EllipsizeMode.END} hexpand />
                                <GtkButton
                                    iconName="window-close-symbolic"
                                    accessibleLabel={`Remove ${label}`}
                                    cssClasses={["flat", "circular"]}
                                    onClicked={() => setTags((current) => current.filter((tag) => tag.id !== id))}
                                />
                            </GtkBox>
                        ))}
                        <GtkButton
                            iconName="list-add-symbolic"
                            accessibleLabel="Add tag"
                            cssClasses={["flat", "circular"]}
                            onClicked={addTag}
                        />
                    </AdwWrapBox>
                </AdwClamp>
            </AdwStatusPage>
        </AdwToolbarView>
    );
};
