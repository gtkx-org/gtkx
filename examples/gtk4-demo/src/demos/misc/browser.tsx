import * as Gtk from "@gtkx/ffi/gtk";
import * as WebKit from "@gtkx/ffi/webkit";
import { Box, Button, Entry, WebKitWebView } from "@gtkx/react";
import { useCallback, useRef, useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const BrowserDemo = () => {
    const webViewRef = useRef<WebKit.WebView>(null);
    const [url, setUrl] = useState("https://gtk.org");
    const [inputUrl, setInputUrl] = useState("https://gtk.org");

    const navigate = useCallback((targetUrl: string) => {
        if (!webViewRef.current) {
            return;
        }

        let finalUrl = targetUrl.trim();
        if (!finalUrl.startsWith("http://") && !finalUrl.startsWith("https://")) {
            finalUrl = `https://${finalUrl}`;
        }

        webViewRef.current.loadUri(finalUrl);
        setUrl(finalUrl);
    }, []);

    const handleActivate = useCallback(() => {
        navigate(inputUrl);
    }, [navigate, inputUrl]);

    const handleBack = useCallback(() => {
        webViewRef.current?.goBack();
    }, []);

    const handleForward = useCallback(() => {
        webViewRef.current?.goForward();
    }, []);

    const handleReload = useCallback(() => {
        webViewRef.current?.reload();
    }, []);

    const handleLoadChanged = useCallback((_self: WebKit.WebView, loadEvent: WebKit.LoadEvent) => {
        if (loadEvent === WebKit.LoadEvent.COMMITTED) {
            const currentUri = webViewRef.current?.getUri();
            if (currentUri) {
                setInputUrl(currentUri);
                setUrl(currentUri);
            }
        }
    }, []);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={6} hexpand vexpand>
            <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={6}>
                <Button iconName="go-previous-symbolic" onClicked={handleBack} tooltipText="Back" />
                <Button iconName="go-next-symbolic" onClicked={handleForward} tooltipText="Forward" />
                <Button iconName="view-refresh-symbolic" onClicked={handleReload} tooltipText="Reload" />
                <Entry
                    text={inputUrl}
                    hexpand
                    onChanged={(entry) => setInputUrl(entry.getText())}
                    onActivate={handleActivate}
                    placeholderText="Enter URL..."
                />
                <Button label="Go" onClicked={handleActivate} cssClasses={["suggested-action"]} />
            </Box>
            <WebKitWebView ref={webViewRef} hexpand vexpand uri={url} onLoadChanged={handleLoadChanged} />
        </Box>
    );
};

export const browserDemo: Demo = {
    id: "browser",
    title: "Web Browser",
    description: "A simple web browser using WebKitWebView with navigation controls.",
    keywords: ["browser", "webkit", "web", "internet", "WebKitWebView"],
    component: BrowserDemo,
    sourcePath: getSourcePath(import.meta.url, "browser.tsx"),
};
