import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import {
  useBiDashboardsList,
  useBiDashboardsCreate,
  useBiDashboardsUpdate,
  useBiDashboardsDestroy,
  useBiWorkspacesList,
  getBiDashboardsListQueryKey,
} from "@/client/gen/dashy/bi/bi";
import type { Dashboard } from "@/client/gen/dashy";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Skeleton } from "@/components/ui/skeleton";

const dashboardSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  type: z.string().min(1, "Type is required").max(100),
  workspace: z.coerce.number().min(1, "Workspace is required"),
  created_by: z.coerce.number().optional().nullable(),
  config: z.any().optional(),
});

type DashboardFormValues = z.infer<typeof dashboardSchema>;

const DASHBOARD_TYPES = [
  { value: "analytics", label: "Analytics" },
  { value: "reporting", label: "Reporting" },
  { value: "kpi", label: "KPI Dashboard" },
  { value: "operational", label: "Operational" },
  { value: "executive", label: "Executive" },
];

export function DashboardsPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingDashboard, setEditingDashboard] = useState<Dashboard | null>(
    null
  );
  const [deletingDashboard, setDeletingDashboard] = useState<Dashboard | null>(
    null
  );

  const { data: dashboards, isLoading, error } = useBiDashboardsList();
  const { data: workspaces } = useBiWorkspacesList();

  const createMutation = useBiDashboardsCreate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getBiDashboardsListQueryKey(),
        });
        setIsCreateOpen(false);
        toast.success("Dashboard created successfully");
      },
      onError: () => {
        toast.error("Failed to create dashboard");
      },
    },
  });

  const updateMutation = useBiDashboardsUpdate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getBiDashboardsListQueryKey(),
        });
        setEditingDashboard(null);
        toast.success("Dashboard updated successfully");
      },
      onError: () => {
        toast.error("Failed to update dashboard");
      },
    },
  });

  const deleteMutation = useBiDashboardsDestroy({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getBiDashboardsListQueryKey(),
        });
        setDeletingDashboard(null);
        toast.success("Dashboard deleted successfully");
      },
      onError: () => {
        toast.error("Failed to delete dashboard");
      },
    },
  });

  const form = useForm<DashboardFormValues>({
    resolver: zodResolver(dashboardSchema),
    defaultValues: {
      name: "",
      type: "",
      workspace: 0,
      created_by: null,
      config: {},
    },
  });

  const editForm = useForm<DashboardFormValues>({
    resolver: zodResolver(dashboardSchema),
  });

  const onCreateSubmit = (data: DashboardFormValues) => {
    createMutation.mutate({ data: data as any });
  };

  const onEditSubmit = (data: DashboardFormValues) => {
    if (editingDashboard) {
      updateMutation.mutate({ id: editingDashboard.id, data: data as any });
    }
  };

  const handleEdit = (dashboard: Dashboard) => {
    editForm.reset({
      name: dashboard.name,
      type: dashboard.type,
      workspace: dashboard.workspace,
      created_by: dashboard.created_by,
      config: dashboard.config || {},
    });
    setEditingDashboard(dashboard);
  };

  const handleDelete = () => {
    if (deletingDashboard) {
      deleteMutation.mutate({ id: deletingDashboard.id });
    }
  };

  const getWorkspaceName = (id: number) => {
    return workspaces?.find((ws) => ws.id === id)?.name || `Workspace #${id}`;
  };

  const getTypeLabel = (type: string) => {
    return DASHBOARD_TYPES.find((t) => t.value === type)?.label || type;
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-center text-destructive">
            Failed to load dashboards. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboards</h1>
          <p className="text-muted-foreground">
            Create and manage your business intelligence dashboards.
          </p>
        </div>
        <Button
          onClick={() => {
            form.reset({
              name: "",
              type: "",
              workspace: 0,
              created_by: null,
              config: {},
            });
            setIsCreateOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Dashboard
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Dashboards</CardTitle>
          <CardDescription>
            A list of all dashboards in the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : dashboards && dashboards.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Workspace</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {dashboards.map((dashboard) => (
                  <TableRow key={dashboard.id}>
                    <TableCell className="font-medium">
                      {dashboard.id}
                    </TableCell>
                    <TableCell>{dashboard.name}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {getTypeLabel(dashboard.type)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {getWorkspaceName(dashboard.workspace)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(dashboard)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingDashboard(dashboard)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="flex flex-col items-center justify-center py-10">
              <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No dashboards found.</p>
              <Button variant="link" onClick={() => setIsCreateOpen(true)}>
                Create your first dashboard
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Dashboard</DialogTitle>
            <DialogDescription>
              Add a new dashboard to a workspace.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onCreateSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Dashboard name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DASHBOARD_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="workspace"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workspace</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select workspace" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {workspaces?.map((ws) => (
                          <SelectItem key={ws.id} value={ws.id.toString()}>
                            {ws.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsCreateOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog
        open={!!editingDashboard}
        onOpenChange={() => setEditingDashboard(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Dashboard</DialogTitle>
            <DialogDescription>Update dashboard details.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onEditSubmit)}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Dashboard name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {DASHBOARD_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="workspace"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Workspace</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select workspace" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {workspaces?.map((ws) => (
                          <SelectItem key={ws.id} value={ws.id.toString()}>
                            {ws.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingDashboard(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={updateMutation.isPending}>
                  {updateMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Save Changes
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={!!deletingDashboard}
        onOpenChange={() => setDeletingDashboard(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Dashboard</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingDashboard?.name}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
