import type * as WebKit from "@gtkx/ffi/webkit";
import type { Props } from "../types.js";
import type { SignalHandler } from "./internal/signal-store.js";
import { hasChanged, propNameToSignalName, resolveSignal } from "./internal/utils.js";
import { WidgetNode } from "./widget.js";

const OWN_PROPS = ["onLoadChanged"] as const;
const NON_BLOCKABLE_SIGNALS = ["load-changed"] as const;

type WebViewProps = Props & {
    onLoadChanged?: SignalHandler;
};

export class WebViewNode extends WidgetNode<WebKit.WebView, WebViewProps> {
    protected override readonly excludedPropNames = OWN_PROPS;

    public override commitUpdate(oldProps: WebViewProps | null, newProps: WebViewProps): void {
        super.commitUpdate(oldProps, newProps);
        this.applyNonBlockableSignals(oldProps, newProps);
    }

    private applyNonBlockableSignals(oldProps: WebViewProps | null, newProps: WebViewProps): void {
        for (const propName of NON_BLOCKABLE_SIGNALS) {
            const camelCaseName =
                `on${propName.charAt(0).toUpperCase()}${propName.slice(1).replace(/-([a-z])/g, (_, c) => c.toUpperCase())}` as keyof WebViewProps;

            if (hasChanged(oldProps, newProps, camelCaseName)) {
                const signalName = propNameToSignalName(camelCaseName);

                if (resolveSignal(this.container, signalName)) {
                    const newValue = newProps[camelCaseName];
                    const handler = typeof newValue === "function" ? (newValue as SignalHandler) : undefined;
                    this.signalStore.set(this, this.container, signalName, handler, { blockable: false });
                }
            }
        }
    }
}
