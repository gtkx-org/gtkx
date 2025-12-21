import * as Gtk from "@gtkx/ffi/gtk";
import { ColumnViewColumn, GtkBox, GtkColumnView, GtkLabel, GtkScrolledWindow, ListItem } from "@gtkx/react";
import { useCallback, useMemo, useState } from "react";

interface Employee {
    id: string;
    name: string;
    department: string;
    salary: number;
    startDate: string;
    status: "active" | "on-leave" | "remote";
}

const firstNames = [
    "Alice",
    "Bob",
    "Carol",
    "David",
    "Eve",
    "Frank",
    "Grace",
    "Henry",
    "Ivy",
    "Jack",
    "Kate",
    "Leo",
    "Maya",
    "Noah",
    "Olivia",
    "Peter",
    "Quinn",
    "Rachel",
    "Sam",
    "Tina",
    "Uma",
    "Victor",
    "Wendy",
    "Xavier",
    "Yara",
    "Zach",
    "Anna",
    "Brian",
    "Clara",
    "Derek",
];

const lastNames = [
    "Johnson",
    "Smith",
    "Williams",
    "Brown",
    "Davis",
    "Miller",
    "Wilson",
    "Taylor",
    "Anderson",
    "Thomas",
    "Jackson",
    "White",
    "Harris",
    "Martin",
    "Garcia",
    "Martinez",
    "Robinson",
    "Clark",
    "Rodriguez",
    "Lewis",
    "Lee",
    "Walker",
    "Hall",
    "Allen",
    "Young",
    "King",
    "Wright",
    "Scott",
    "Green",
    "Adams",
];

const departments = ["Engineering", "Design", "Marketing", "Sales", "HR", "Finance", "Operations", "Legal"];
const statuses: Employee["status"][] = ["active", "on-leave", "remote"];

const generateEmployees = (count: number): Employee[] => {
    const employees: Employee[] = [];
    for (let i = 0; i < count; i++) {
        const firstName = firstNames[i % firstNames.length] ?? "Unknown";
        const lastName = lastNames[Math.floor(i / firstNames.length) % lastNames.length] ?? "Unknown";
        const department = departments[i % departments.length] ?? "Engineering";
        const status = statuses[i % statuses.length] ?? "active";
        const salary = 50000 + Math.floor((i * 7919) % 80000);
        const year = 2020 + (i % 5);
        const month = String((i % 12) + 1).padStart(2, "0");
        const day = String((i % 28) + 1).padStart(2, "0");

        employees.push({
            id: String(i + 1),
            name: `${firstName} ${lastName} ${Math.floor(i / (firstNames.length * lastNames.length)) || ""}`.trim(),
            department,
            salary,
            startDate: `${year}-${month}-${day}`,
            status,
        });
    }
    return employees;
};

const employees = generateEmployees(500);

const statusColors: Record<Employee["status"], string> = {
    active: "success",
    "on-leave": "warning",
    remote: "accent",
};

type SortColumn = "name" | "department" | "salary" | "startDate" | null;

export const ColumnViewDemo = () => {
    const [sortColumn, setSortColumn] = useState<SortColumn>("name");
    const [sortOrder, setSortOrder] = useState<Gtk.SortType>(Gtk.SortType.ASCENDING);

    const handleSortChange = useCallback((column: string | null, order: Gtk.SortType) => {
        setSortColumn(column as SortColumn);
        setSortOrder(order);
    }, []);

    const sortedEmployees = useMemo(() => {
        if (!sortColumn) return employees;

        const sorted = [...employees].sort((a, b) => {
            let comparison = 0;
            switch (sortColumn) {
                case "name":
                    comparison = a.name.localeCompare(b.name);
                    break;
                case "department":
                    comparison = a.department.localeCompare(b.department);
                    break;
                case "salary":
                    comparison = a.salary - b.salary;
                    break;
                case "startDate":
                    comparison = new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
                    break;
            }
            return sortOrder === Gtk.SortType.ASCENDING ? comparison : -comparison;
        });

        return sorted;
    }, [sortColumn, sortOrder]);

    const formatSalary = (salary: number) => `$${salary.toLocaleString()}`;
    const formatDate = (date: string) => new Date(date).toLocaleDateString();

    const sortIndicator = sortColumn
        ? `Sorted by ${sortColumn} (${sortOrder === Gtk.SortType.ASCENDING ? "↑" : "↓"})`
        : "Click column headers to sort";

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={16}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
            hexpand
            vexpand
        >
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="ColumnView" cssClasses={["title-1"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkColumnView displays data in a table with multiple columns. It supports sortable columns, resizable columns, and virtual scrolling for large datasets."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12} vexpand>
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
                    <GtkLabel
                        label={`Employee Directory (${employees.length.toLocaleString()} employees)`}
                        cssClasses={["heading"]}
                        halign={Gtk.Align.START}
                        hexpand
                    />
                    <GtkLabel label={sortIndicator} cssClasses={["dim-label"]} />
                </GtkBox>

                <GtkScrolledWindow vexpand hexpand cssClasses={["card"]}>
                    <GtkColumnView
                        sortColumn={sortColumn}
                        sortOrder={sortOrder}
                        onSortChange={handleSortChange}
                        vexpand
                        hexpand
                    >
                        <ColumnViewColumn
                            id="name"
                            title="Name"
                            expand
                            resizable
                            sortable
                            renderCell={(emp: Employee | null) => (
                                <GtkLabel
                                    label={emp?.name ?? ""}
                                    halign={Gtk.Align.START}
                                    marginStart={8}
                                    marginEnd={8}
                                    marginTop={6}
                                    marginBottom={6}
                                />
                            )}
                        />
                        <ColumnViewColumn
                            id="department"
                            title="Department"
                            resizable
                            sortable
                            renderCell={(emp: Employee | null) => (
                                <GtkLabel
                                    label={emp?.department ?? ""}
                                    halign={Gtk.Align.START}
                                    marginStart={8}
                                    marginEnd={8}
                                    marginTop={6}
                                    marginBottom={6}
                                />
                            )}
                        />
                        <ColumnViewColumn
                            id="salary"
                            title="Salary"
                            resizable
                            sortable
                            renderCell={(emp: Employee | null) => (
                                <GtkLabel
                                    label={emp ? formatSalary(emp.salary) : ""}
                                    halign={Gtk.Align.END}
                                    marginStart={8}
                                    marginEnd={8}
                                    marginTop={6}
                                    marginBottom={6}
                                />
                            )}
                        />
                        <ColumnViewColumn
                            id="startDate"
                            title="Start Date"
                            resizable
                            sortable
                            renderCell={(emp: Employee | null) => (
                                <GtkLabel
                                    label={emp ? formatDate(emp.startDate) : ""}
                                    halign={Gtk.Align.START}
                                    marginStart={8}
                                    marginEnd={8}
                                    marginTop={6}
                                    marginBottom={6}
                                    cssClasses={["dim-label"]}
                                />
                            )}
                        />
                        <ColumnViewColumn
                            title="Status"
                            fixedWidth={100}
                            renderCell={(emp: Employee | null) => (
                                <GtkLabel
                                    label={emp?.status ?? ""}
                                    halign={Gtk.Align.CENTER}
                                    marginTop={6}
                                    marginBottom={6}
                                    cssClasses={emp ? [statusColors[emp.status], "caption"] : []}
                                />
                            )}
                        />
                        {sortedEmployees.map((emp) => (
                            <ListItem key={emp.id} id={emp.id} value={emp} />
                        ))}
                    </GtkColumnView>
                </GtkScrolledWindow>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Key Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={
                        "• Sortable columns with sortFn and onSortChange\n• Resizable columns with resizable prop\n• Fixed-width columns with fixedWidth prop\n• renderCell for custom cell content\n• Virtual scrolling for performance"
                    }
                    wrap
                    halign={Gtk.Align.START}
                    cssClasses={["dim-label"]}
                />
            </GtkBox>
        </GtkBox>
    );
};
