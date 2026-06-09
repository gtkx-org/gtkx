import * as Adw from "@gtkx/gi/adw";
import * as Pango from "@gtkx/gi/pango";
import { GtkLabel } from "@gtkx/react-gi/gtk";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./links.tsx?raw";

const LinksDemo = ({ window }: DemoProps) => {
    const handleActivateLink = (uri: string) => {
        if (uri === "keynav") {
            const dialog = new Adw.AlertDialog();
            dialog.setHeading("Keyboard navigation");
            dialog.setBody(
                "The term ‘keynav’ is a shorthand for keyboard navigation and refers to the process of using a program (exclusively) via keyboard input.",
            );
            dialog.addResponse("ok", "_OK");
            dialog.setDefaultResponse("ok");
            dialog.setCloseResponse("ok");
            void dialog.choose(window.current, null);
            return true;
        }
        return false;
    };

    return (
        <GtkLabel
            name="links-label"
            label={
                'Some <a href="http://en.wikipedia.org/wiki/Text" title="plain text">text</a> may be marked up ' +
                "as hyperlinks, which can be clicked " +
                'or activated via <a href="keynav">keynav</a> ' +
                "and they work fine with other markup, like when " +
                'linking to <a href="http://www.flathub.org/"><b>' +
                '<span letter_spacing="1024" underline="none" color="pink" background="darkslategray">Flathub</span>' +
                "</b></a>."
            }
            useMarkup
            maxWidthChars={40}
            wrap
            wrapMode={Pango.WrapMode.WORD}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
            onActivateLink={(uri) => handleActivateLink(uri)}
        />
    );
};

export const linksDemo: Demo = {
    id: "links",
    title: "Links",
    description:
        "GtkLabel can show hyperlinks. The default action is to call gtk_show_uri() on their URI, but it is possible to override this with a custom handler.",
    keywords: [],
    component: LinksDemo,
    sourceCode,
    resizable: false,
};
