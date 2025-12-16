import * as Gtk from "@gtkx/ffi/gtk";
import { Box, ColumnView, Label, ScrolledWindow } from "@gtkx/react";
import { useCallback, useState } from "react";

interface Employee {
    id: string;
    name: string;
    department: string;
    salary: number;
    startDate: string;
    status: "active" | "on-leave" | "remote";
}

const employees: Employee[] = [
    {
        id: "1",
        name: "Alice Johnson",
        department: "Engineering",
        salary: 95000,
        startDate: "2021-03-15",
        status: "active",
    },
    { id: "2", name: "Bob Smith", department: "Design", salary: 82000, startDate: "2020-06-01", status: "remote" },
    {
        id: "3",
        name: "Carol Williams",
        department: "Marketing",
        salary: 78000,
        startDate: "2022-01-10",
        status: "active",
    },
    {
        id: "4",
        name: "David Brown",
        department: "Engineering",
        salary: 105000,
        startDate: "2019-09-22",
        status: "active",
    },
    { id: "5", name: "Eve Davis", department: "Sales", salary: 88000, startDate: "2021-07-05", status: "on-leave" },
    {
        id: "6",
        name: "Frank Miller",
        department: "Engineering",
        salary: 92000,
        startDate: "2020-11-30",
        status: "remote",
    },
    { id: "7", name: "Grace Wilson", department: "Design", salary: 85000, startDate: "2022-04-18", status: "active" },
    {
        id: "8",
        name: "Henry Taylor",
        department: "Marketing",
        salary: 72000,
        startDate: "2023-02-14",
        status: "active",
    },
    {
        id: "9",
        name: "Ivy Anderson",
        department: "Engineering",
        salary: 110000,
        startDate: "2018-08-07",
        status: "active",
    },
    { id: "10", name: "Jack Thomas", department: "Sales", salary: 91000, startDate: "2021-05-20", status: "remote" },
    {
        id: "11",
        name: "Kate Jackson",
        department: "Engineering",
        salary: 98000,
        startDate: "2020-02-28",
        status: "active",
    },
    { id: "12", name: "Leo White", department: "Design", salary: 79000, startDate: "2022-09-12", status: "on-leave" },
];

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

    const sortFn = useCallback((a: Employee, b: Employee, columnId: string): number => {
        switch (columnId) {
            case "name":
                return a.name.localeCompare(b.name);
            case "department":
                return a.department.localeCompare(b.department);
            case "salary":
                return a.salary - b.salary;
            case "startDate":
                return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
            default:
                return 0;
        }
    }, []);

    const formatSalary = (salary: number) => `$${salary.toLocaleString()}`;
    const formatDate = (date: string) => new Date(date).toLocaleDateString();

    const sortIndicator = sortColumn
        ? `Sorted by ${sortColumn} (${sortOrder === Gtk.SortType.ASCENDING ? "↑" : "↓"})`
        : "Click column headers to sort";

    return (
        <Box
            orientation={Gtk.Orientation.VERTICAL}
            spacing={16}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
            hexpand
            vexpand
        >
            <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <Label label="ColumnView" cssClasses={["title-1"]} halign={Gtk.Align.START} />
                <Label
                    label="GtkColumnView displays data in a table with multiple columns. It supports sortable columns, resizable columns, and virtual scrolling for large datasets."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12} vexpand>
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
                    <Label label="Employee Directory" cssClasses={["heading"]} halign={Gtk.Align.START} hexpand />
                    <Label label={sortIndicator} cssClasses={["dim-label"]} />
                </Box>

                <ScrolledWindow vexpand hexpand cssClasses={["card"]}>
                    <ColumnView.Root
                        sortColumn={sortColumn}
                        sortOrder={sortOrder}
                        sortFn={sortFn}
                        onSortChange={handleSortChange}
                        vexpand
                        hexpand
                    >
                        <ColumnView.Column
                            id="name"
                            title="Name"
                            expand
                            resizable
                            renderCell={(emp: Employee | null) => (
                                <Label
                                    label={emp?.name ?? ""}
                                    halign={Gtk.Align.START}
                                    marginStart={8}
                                    marginEnd={8}
                                    marginTop={6}
                                    marginBottom={6}
                                />
                            )}
                        />
                        <ColumnView.Column
                            id="department"
                            title="Department"
                            resizable
                            renderCell={(emp: Employee | null) => (
                                <Label
                                    label={emp?.department ?? ""}
                                    halign={Gtk.Align.START}
                                    marginStart={8}
                                    marginEnd={8}
                                    marginTop={6}
                                    marginBottom={6}
                                />
                            )}
                        />
                        <ColumnView.Column
                            id="salary"
                            title="Salary"
                            resizable
                            renderCell={(emp: Employee | null) => (
                                <Label
                                    label={emp ? formatSalary(emp.salary) : ""}
                                    halign={Gtk.Align.END}
                                    marginStart={8}
                                    marginEnd={8}
                                    marginTop={6}
                                    marginBottom={6}
                                />
                            )}
                        />
                        <ColumnView.Column
                            id="startDate"
                            title="Start Date"
                            resizable
                            renderCell={(emp: Employee | null) => (
                                <Label
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
                        <ColumnView.Column
                            title="Status"
                            fixedWidth={100}
                            renderCell={(emp: Employee | null) => (
                                <Label
                                    label={emp?.status ?? ""}
                                    halign={Gtk.Align.CENTER}
                                    marginTop={6}
                                    marginBottom={6}
                                    cssClasses={emp ? [statusColors[emp.status], "caption"] : []}
                                />
                            )}
                        />
                        {employees.map((emp) => (
                            <ColumnView.Item key={emp.id} item={emp} />
                        ))}
                    </ColumnView.Root>
                </ScrolledWindow>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <Label label="Key Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="• Sortable columns with sortFn and onSortChange\n• Resizable columns with resizable prop\n• Fixed-width columns with fixedWidth prop\n• renderCell for custom cell content\n• Virtual scrolling for performance"
                    wrap
                    halign={Gtk.Align.START}
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
    );
};
