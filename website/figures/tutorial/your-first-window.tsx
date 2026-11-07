import {
    AdwApplication,
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwStatusPage,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { quit } from "@gtkx/react";

export function App() {
    return (
        <AdwApplication>
            <AdwApplicationWindow
                title="Tasks"
                widthRequest={360}
                heightRequest={294}
                onCloseRequest={() => quit()}
            >
                <AdwToolbarView top={<AdwHeaderBar />}>
                    <AdwStatusPage
                        iconName="checkbox-checked-symbolic"
                        title="No Tasks Yet"
                        description="Your tasks will show up here."
                    />
                </AdwToolbarView>
            </AdwApplicationWindow>
        </AdwApplication>
    );
}
