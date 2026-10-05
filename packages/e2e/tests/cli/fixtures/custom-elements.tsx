import { ParamFlags, paramSpecString } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
import { GtkAdjustment, type GtkScaleProps } from "@gtkx/jsx/gtk";
import { createElementComponent, createRoot, quit } from "@gtkx/react";
import { registerClass } from "@gtkx/runtime";
import process from "node:process";
import { useEffect, useRef } from "react";

const constructed: string[] = [];
const mode = process.env.GTKX_CUSTOM_ELEMENT_MODE;
const initialToken = mode === "defaults" ? undefined : "session";

class TaggedScaleBase extends Gtk.Scale {
    declare tag: string;
    declare token: string;

    override vfuncConstructed() {
        super.vfuncConstructed();
        constructed.push(this.token);
    }
}

const TaggedScale = registerClass(TaggedScaleBase, {
    typeName: "GtkxProductionTaggedScale",
    properties: {
        tag: paramSpecString("tag", null, null, "untagged", ParamFlags.READWRITE),
        token: paramSpecString("token", null, null, "default-token", ParamFlags.READWRITE | ParamFlags.CONSTRUCT_ONLY),
    },
});

type TaggedScale = InstanceType<typeof TaggedScale>;
type TaggedScaleProps = GtkScaleProps<TaggedScale> & { tag?: string | undefined; token?: string | undefined };

const TaggedScaleElement = createElementComponent<TaggedScaleProps>("GtkxProductionTaggedScale", TaggedScale);

const App = ({ phase }: { phase: number }) => {
    const ref = useRef<TaggedScale>(null);

    useEffect(() => {
        const object = ref.current;
        if (object === null) {
            throw new Error("Missing rendered scale");
        }

        process.send?.({ digits: object.getDigits(), tag: object.tag, token: object.token, constructed });
        if (mode === "defaults" || phase === 1) {
            quit();
        }
    }, [phase]);

    const isConfigured = mode !== "defaults" && phase === 0;
    const token = mode === "update" && phase === 1 ? "changed" : initialToken;

    return (
        <AdwApplicationWindow defaultWidth={300} defaultHeight={150}>
            <TaggedScaleElement
                ref={ref}
                digits={isConfigured ? 3 : undefined}
                tag={isConfigured ? "volume" : undefined}
                token={token}
                adjustment={<GtkAdjustment lower={0} upper={100} value={40} />}
            />
        </AdwApplicationWindow>
    );
};

const root = createRoot(undefined, {
    onUncaughtError: () => {
        process.exitCode = 17;
        quit();
    },
});

process.on("message", () => {
    root.render(<AdwApplication><App phase={1} /></AdwApplication>);
});
process.channel?.unref();

root.render(<AdwApplication><App phase={0} /></AdwApplication>);
