import { SearchButton } from "./search-button.js";
import { AdwApplicationWindow, AdwStatusPage } from "@gtkx/jsx/adw";
import { NavigationContainer } from "@gtkx/navigation";
import { quit } from "@gtkx/react";
import { ALL_TASKS, Split } from "../navigation.js";
import { selectionTitle } from "../store/selectors.js";
import { useStore } from "../store/index.js";
import { Sidebar } from "./sidebar.js";
import { TasksScreen } from "./tasks-screen.js";

const NothingSelected = () => (
    <AdwStatusPage
        iconName="view-list-symbolic"
        title="Nothing Selected"
        description="Pick a list or a smart view in the sidebar"
    />
);

export const Window = () => {
    const lists = useStore((state) => state.lists);

    return (
        <AdwApplicationWindow
            title="Tasks"
            widthRequest={360}
            heightRequest={294}
            onCloseRequest={() => quit()}
        >
            <NavigationContainer>
                <Split.Navigator
                    initialRouteName="Tasks"
                    collapseCondition="max-width: 500sp"
                    sidebarWidthFraction={0.25}
                    minSidebarWidth={220}
                    maxSidebarWidth={300}
                    contentPlaceholder={<NothingSelected />}
                >
                    <Split.Screen
                        name="Lists"
                        component={Sidebar}
                        options={{ title: "Tasks" }}
                    />
                    <Split.Screen
                        name="Tasks"
                        component={TasksScreen}
                        initialParams={ALL_TASKS}
                        options={({ route }) => ({
                            title: selectionTitle(route.params, lists),
                            headerStart: <SearchButton />,
                        })}
                    />
                </Split.Navigator>
            </NavigationContainer>
        </AdwApplicationWindow>
    );
};
