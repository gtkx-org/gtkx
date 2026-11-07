import {
    AdwApplication,
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { quit } from "@gtkx/react";
import { TaskList } from "./components/task-list.js";

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
                    <TaskList />
                </AdwToolbarView>
            </AdwApplicationWindow>
        </AdwApplication>
    );
}
