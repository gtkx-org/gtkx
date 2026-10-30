import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwBanner,
    AdwClamp,
    AdwEntryRow,
    AdwHeaderBar,
    AdwPreferencesGroup,
    AdwStatusPage,
    AdwSwitchRow,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GtkCenterBox, GtkSwitch } from "@gtkx/jsx/gtk";
import { useState } from "react";
import { useDemo } from "../context.js";

export const BannersPage = () => {
    const { notify } = useDemo();
    const [revealed, setRevealed] = useState(true);
    const [title, setTitle] = useState("Metered connection — updates paused");
    const [buttonLabel, setButtonLabel] = useState("_Network Settings");
    const [hasButton, setHasButton] = useState(true);
    const [suggested, setSuggested] = useState(false);

    return (
        <AdwToolbarView top={<AdwHeaderBar showTitle={false} />}>
            <GtkCenterBox
                orientation={Gtk.Orientation.VERTICAL}
                vexpand
                startWidget={
                    <AdwBanner
                        title={title}
                        revealed={revealed}
                        onNotifyRevealed={(value) => setRevealed(value ?? false)}
                        buttonLabel={hasButton ? buttonLabel : ""}
                        buttonStyle={suggested ? Adw.BannerButtonStyle.SUGGESTED : Adw.BannerButtonStyle.DEFAULT}
                        onButtonClicked={() => notify("Banner action triggered")}
                    />
                }
                centerWidget={
                    <AdwStatusPage
                        iconName="widget-banner-symbolic"
                        title="Banner"
                        description="A bar with contextual information"
                    >
                        <AdwClamp maximumSize={400} tighteningThreshold={300}>
                            <AdwPreferencesGroup>
                                <AdwSwitchRow
                                    title="Show Banner"
                                    active={revealed}
                                    onNotifyActive={(value) => setRevealed(value ?? false)}
                                />
                                <AdwEntryRow
                                    title="Title"
                                    useUnderline
                                    text={title}
                                    onNotifyText={(value) => setTitle(value ?? "")}
                                    inputHints={
                                        Gtk.InputHints.SPELLCHECK |
                                        Gtk.InputHints.WORD_COMPLETION |
                                        Gtk.InputHints.UPPERCASE_SENTENCES
                                    }
                                />
                                <AdwEntryRow
                                    title="Button"
                                    useUnderline
                                    text={buttonLabel}
                                    onNotifyText={(value) => setButtonLabel(value ?? "")}
                                    editable={hasButton}
                                    inputHints={
                                        Gtk.InputHints.SPELLCHECK |
                                        Gtk.InputHints.WORD_COMPLETION |
                                        Gtk.InputHints.UPPERCASE_WORDS
                                    }
                                    suffix={
                                        <GtkSwitch
                                            accessibleLabel="Show banner button"
                                            valign={Gtk.Align.CENTER}
                                            active={hasButton}
                                            onNotifyActive={(value) => setHasButton(value ?? false)}
                                        />
                                    }
                                />
                                <AdwSwitchRow
                                    title="Suggested Style"
                                    sensitive={hasButton}
                                    active={suggested}
                                    onNotifyActive={(value) => setSuggested(value ?? false)}
                                />
                            </AdwPreferencesGroup>
                        </AdwClamp>
                    </AdwStatusPage>
                }
            />
        </AdwToolbarView>
    );
};
