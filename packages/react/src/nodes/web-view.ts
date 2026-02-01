import type * as WebKit from "@gtkx/ffi/webkit";
import type { WebKitWebViewProps } from "../jsx.js";
import { resolveSignal } from "../metadata.js";
import { filterProps, hasChanged } from "./internal/props.js";
import type { SignalHandler } from "./internal/signal-store.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["onLoadChanged"] as const;

type WebViewProps = Pick<WebKitWebViewProps, (typeof OWN_PROPS)[number]>;

export class WebViewNode extends WidgetNode<WebKit.WebView, WebViewProps> {
    public override commitUpdate(oldProps: WebViewProps | null, newProps: WebViewProps): void {
        super.commitUpdate(oldProps ? filterProps(oldProps, OWN_PROPS) : null, filterProps(newProps, OWN_PROPS));
        this.applyOwnProps(oldProps, newProps);
    }

    private applyOwnProps(oldProps: WebViewProps | null, newProps: WebViewProps): void {
        for (const propName of OWN_PROPS) {
            if (hasChanged(oldProps, newProps, propName)) {
                const signalName = resolveSignal(this.container, propName);
                if (!signalName) continue;

                const newValue = newProps[propName];
                const handler = typeof newValue === "function" ? (newValue as SignalHandler) : undefined;
                this.signalStore.set(this, this.container, signalName, handler, { blockable: false });
            }
        }
    }
}
