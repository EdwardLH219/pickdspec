"use client";

import { useState } from "react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
  getSortedRowModel,
  SortingState,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskWithDetails } from "@/lib/data/tasks";
import { TaskStatus } from "@/lib/types";
import {
  CheckCircle2,
  Circle,
  Clock,
  XCircle,
  ArrowUpDown,
  ChevronRight,
  ListTodo,
} from "lucide-react";

interface TasksTableProps {
  tasks: TaskWithDetails[];
  onStatusChange: (taskId: string, newStatus: TaskStatus) => void;
  onMarkComplete: (taskId: string) => void;
  onSelectTask: (task: TaskWithDetails) => void;
  selectedTaskId?: string;
}

const statusConfig: Record<TaskStatus, { icon: React.ReactNode; label: string; color: string }> = {
  pending: {
    icon: <Circle className="h-4 w-4" />,
    label: "Not Started",
    color: "text-gray-500",
  },
  in_progress: {
    icon: <Clock className="h-4 w-4" />,
    label: "In Progress",
    color: "text-blue-500",
  },
  completed: {
    icon: <CheckCircle2 className="h-4 w-4" />,
    label: "Done",
    color: "text-emerald-500",
  },
  cancelled: {
    icon: <XCircle className="h-4 w-4" />,
    label: "Cancelled",
    color: "text-gray-400",
  },
};

export function TasksTable({
  tasks,
  onStatusChange,
  onMarkComplete,
  onSelectTask,
  selectedTaskId,
}: TasksTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns: ColumnDef<TaskWithDetails>[] = [
    {
      accessorKey: "title",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Task
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => (
        <div className="max-w-[300px]">
          <p className="font-medium truncate">{row.getValue("title")}</p>
          {row.original.description && (
            <p className="text-xs text-muted-foreground truncate">
              {row.original.description}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: "theme",
      header: "Theme",
      cell: ({ row }) => {
        const theme = row.original.theme;
        return theme ? (
          <Badge variant="secondary" className="font-normal">
            {theme.name}
          </Badge>
        ) : (
          <span className="text-muted-foreground text-sm">—</span>
        );
      },
    },
    {
      accessorKey: "status",
      header: "Status",
      cell: ({ row }) => {
        const status = row.getValue("status") as TaskStatus;
        const task = row.original;
        const config = statusConfig[status];

        return (
          <Select
            value={status}
            onValueChange={(value) => onStatusChange(task.id, value as TaskStatus)}
          >
            <SelectTrigger className="w-[140px] h-8">
              <div className={`flex items-center gap-2 ${config.color}`}>
                {config.icon}
                <span className="text-foreground">{config.label}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">
                <div className="flex items-center gap-2">
                  <Circle className="h-4 w-4 text-gray-500" />
                  Not Started
                </div>
              </SelectItem>
              <SelectItem value="in_progress">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-500" />
                  In Progress
                </div>
              </SelectItem>
              <SelectItem value="completed">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  Done
                </div>
              </SelectItem>
              <SelectItem value="cancelled">
                <div className="flex items-center gap-2">
                  <XCircle className="h-4 w-4 text-gray-400" />
                  Cancelled
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        );
      },
    },
    {
      accessorKey: "dueDate",
      header: ({ column }) => (
        <Button
          variant="ghost"
          onClick={() => column.toggleSorting(column.getIsSorted() === "asc")}
          className="-ml-4"
        >
          Due Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      ),
      cell: ({ row }) => {
        const dueDate = new Date(row.getValue("dueDate"));
        const now = new Date("2026-01-27");
        const isOverdue =
          dueDate < now &&
          row.original.status !== "completed" &&
          row.original.status !== "cancelled";

        return (
          <span className={isOverdue ? "text-rose-600 font-medium" : ""}>
            {dueDate.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
            {isOverdue && (
              <span className="ml-1 text-xs">(Overdue)</span>
            )}
          </span>
        );
      },
    },
    {
      accessorKey: "assignee",
      header: "Assigned To",
      cell: ({ row }) => (
        <span className="text-sm">{row.getValue("assignee")}</span>
      ),
    },
    {
      accessorKey: "completedAt",
      header: "Completed",
      cell: ({ row }) => {
        const completedAt = row.getValue("completedAt") as string | null;
        return completedAt ? (
          <span className="text-sm text-muted-foreground">
            {new Date(completedAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      id: "actions",
      cell: ({ row }) => {
        const task = row.original;
        const isSelected = task.id === selectedTaskId;
        const canComplete =
          task.status !== "completed" && task.status !== "cancelled";

        return (
          <div className="flex items-center gap-2">
            {canComplete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onMarkComplete(task.id)}
                className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
              >
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Complete
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onSelectTask(task)}
              className={isSelected ? "bg-muted" : ""}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        );
      },
    },
  ];

  const table = useReactTable({
    data: tasks,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    onSortingChange: setSorting,
    state: { sorting },
  });

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          {table.getHeaderGroups().map((headerGroup) => (
            <TableRow key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <TableHead key={header.id}>
                  {header.isPlaceholder
                    ? null
                    : flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                </TableHead>
              ))}
            </TableRow>
          ))}
        </TableHeader>
        <TableBody>
          {table.getRowModel().rows?.length ? (
            table.getRowModel().rows.map((row) => (
              <TableRow
                key={row.id}
                data-state={row.original.id === selectedTaskId ? "selected" : undefined}
                className={row.original.id === selectedTaskId ? "bg-muted/50" : ""}
              >
                {row.getVisibleCells().map((cell) => (
                  <TableCell key={cell.id}>
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length} className="h-32 text-center">
                <div className="flex flex-col items-center justify-center py-4">
                  <ListTodo className="h-8 w-8 text-muted-foreground/50 mb-2" />
                  <p className="font-medium">No tasks found</p>
                  <p className="text-sm text-muted-foreground">
                    Try adjusting your filters or add a new task.
                  </p>
                </div>
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  );
}
