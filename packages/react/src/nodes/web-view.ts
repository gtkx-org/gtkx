import type * as WebKit from "@gtkx/ffi/webkit";
import type { WebKitWebViewProps } from "../jsx.js";
import { type PropDescriptorTable, signal } from "./internal/apply-props.js";
import { WidgetNode } from "./widget.js";

type WebViewProps = Pick<WebKitWebViewProps, "onLoadChanged">;

export class WebViewNode extends WidgetNode<WebKit.WebView, WebViewProps> {
    protected override ownPropDescriptors(): PropDescriptorTable {
        return {
            ...super.ownPropDescriptors(),
            onLoadChanged: signal("load-changed", { blockable: false }),
        };
    }
}
