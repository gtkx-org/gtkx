import { AdwApplicationWindow } from "@gtkx/jsx/adw";
import { NavigationContainer } from "@gtkx/navigation";
import { quit } from "@gtkx/react";
import { Split } from "../navigation.js";
import { useStore } from "../store/index.js";
import { Sidebar } from "./sidebar.js";
import { TasksScreen } from "./tasks-screen.js";

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
                    sidebarWidthFraction={0.25}
                    minSidebarWidth={220}
                    maxSidebarWidth={300}
                >
                    <Split.Screen
                        name="Lists"
                        component={Sidebar}
                        options={{ title: "Tasks" }}
                    />
                    <Split.Screen
                        name="Tasks"
                        component={TasksScreen}
                        initialParams={{ kind: "list", listId: "personal" }}
                        options={({ route }) => ({
                            title:
                                lists.find(
                                    (list) => list.id === route.params.listId,
                                )?.name ?? "Tasks",
                        })}
                    />
                </Split.Navigator>
            </NavigationContainer>
        </AdwApplicationWindow>
    );
};
