import { ColumnView, type ColumnViewColumn } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { useState } from "react";

type Employee = { id: string; name: string; team: string };

const employees: Employee[] = [
    { id: "ada", name: "Ada Lovelace", team: "Research" },
    { id: "grace", name: "Grace Hopper", team: "Compilers" },
    { id: "radia", name: "Radia Perlman", team: "Networking" },
    { id: "alan", name: "Alan Turing", team: "Research" },
];

const columns: ColumnViewColumn<Employee>[] = [
    {
        id: "name",
        title: "Name",
        isSortable: true,
        expand: true,
        renderCell: ({ item }) => (
            <GtkLabel halign={Gtk.Align.START}>{item.name}</GtkLabel>
        ),
    },
    {
        id: "team",
        title: "Team",
        isSortable: true,
        expand: true,
        renderCell: ({ item }) => (
            <GtkLabel halign={Gtk.Align.START}>{item.team}</GtkLabel>
        ),
    },
];

function sortEmployees(column: string | null, order: Gtk.SortType) {
    if (column !== "name" && column !== "team") return employees;
    const sorted = [...employees].sort((a, b) =>
        a[column].localeCompare(b[column]),
    );
    return order === Gtk.SortType.DESCENDING ? sorted.reverse() : sorted;
}

export function EmployeeTable() {
    const [sortColumn, setSortColumn] = useState<string | null>("name");
    const [sortOrder, setSortOrder] = useState(Gtk.SortType.ASCENDING);

    return (
        <ColumnView
            sortColumn={sortColumn}
            sortOrder={sortOrder}
            onSortChanged={(column, order) => {
                setSortColumn(column);
                setSortOrder(order);
            }}
            items={sortEmployees(sortColumn, sortOrder).map((employee) => ({
                id: employee.id,
                value: employee,
            }))}
            columns={columns}
        />
    );
}
