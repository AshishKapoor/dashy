import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, Briefcase } from "lucide-react";
import { toast } from "sonner";
import {
  useBiWorkspacesList,
  useBiWorkspacesCreate,
  useBiWorkspacesUpdate,
  useBiWorkspacesDestroy,
  getBiWorkspacesListQueryKey,
} from "@/client/gen/dashy/bi/bi";
import { useAccountsOrganizationsList } from "@/client/gen/dashy/accounts/accounts";
import type { Workspace } from "@/client/gen/dashy";
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
import { Textarea } from "@/components/ui/textarea";
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

const workspaceSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  description: z.string().optional().nullable(),
  organization: z.coerce.number().min(1, "Organization is required"),
});

type WorkspaceFormValues = z.infer<typeof workspaceSchema>;

export function WorkspacesPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(
    null
  );
  const [deletingWorkspace, setDeletingWorkspace] = useState<Workspace | null>(
    null
  );

  const { data: workspaces, isLoading, error } = useBiWorkspacesList();
  const { data: organizations } = useAccountsOrganizationsList();

  const createMutation = useBiWorkspacesCreate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getBiWorkspacesListQueryKey(),
        });
        setIsCreateOpen(false);
        toast.success("Workspace created successfully");
      },
      onError: () => {
        toast.error("Failed to create workspace");
      },
    },
  });

  const updateMutation = useBiWorkspacesUpdate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getBiWorkspacesListQueryKey(),
        });
        setEditingWorkspace(null);
        toast.success("Workspace updated successfully");
      },
      onError: () => {
        toast.error("Failed to update workspace");
      },
    },
  });

  const deleteMutation = useBiWorkspacesDestroy({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getBiWorkspacesListQueryKey(),
        });
        setDeletingWorkspace(null);
        toast.success("Workspace deleted successfully");
      },
      onError: () => {
        toast.error("Failed to delete workspace");
      },
    },
  });

  const form = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceSchema),
    defaultValues: {
      name: "",
      description: "",
      organization: 0,
    },
  });

  const editForm = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceSchema),
  });

  const onCreateSubmit = (data: WorkspaceFormValues) => {
    createMutation.mutate({ data: data as any });
  };

  const onEditSubmit = (data: WorkspaceFormValues) => {
    if (editingWorkspace) {
      updateMutation.mutate({ id: editingWorkspace.id, data: data as any });
    }
  };

  const handleEdit = (workspace: Workspace) => {
    editForm.reset({
      name: workspace.name,
      description: workspace.description || "",
      organization: workspace.organization,
    });
    setEditingWorkspace(workspace);
  };

  const handleDelete = () => {
    if (deletingWorkspace) {
      deleteMutation.mutate({ id: deletingWorkspace.id });
    }
  };

  const getOrganizationName = (id: number) => {
    return organizations?.find((org) => org.id === id)?.name || `Org #${id}`;
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-center text-destructive">
            Failed to load workspaces. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Workspaces</h1>
          <p className="text-muted-foreground">
            Manage your BI workspaces and their configurations.
          </p>
        </div>
        <Button
          onClick={() => {
            form.reset({ name: "", description: "", organization: 0 });
            setIsCreateOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Workspace
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Workspaces</CardTitle>
          <CardDescription>
            A list of all workspaces in the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : workspaces && workspaces.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workspaces.map((workspace) => (
                  <TableRow key={workspace.id}>
                    <TableCell className="font-medium">
                      {workspace.id}
                    </TableCell>
                    <TableCell>{workspace.name}</TableCell>
                    <TableCell className="max-w-xs truncate">
                      {workspace.description || "-"}
                    </TableCell>
                    <TableCell>
                      {getOrganizationName(workspace.organization)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(workspace)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingWorkspace(workspace)}
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
              <Briefcase className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No workspaces found.</p>
              <Button variant="link" onClick={() => setIsCreateOpen(true)}>
                Create your first workspace
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>
              Add a new workspace to organize your dashboards.
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
                      <Input placeholder="Workspace name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Workspace description"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="organization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select organization" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {organizations?.map((org) => (
                          <SelectItem key={org.id} value={org.id.toString()}>
                            {org.name}
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
        open={!!editingWorkspace}
        onOpenChange={() => setEditingWorkspace(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Workspace</DialogTitle>
            <DialogDescription>Update workspace details.</DialogDescription>
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
                      <Input placeholder="Workspace name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (optional)</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Workspace description"
                        {...field}
                        value={field.value || ""}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="organization"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Organization</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select organization" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {organizations?.map((org) => (
                          <SelectItem key={org.id} value={org.id.toString()}>
                            {org.name}
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
                  onClick={() => setEditingWorkspace(null)}
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
        open={!!deletingWorkspace}
        onOpenChange={() => setDeletingWorkspace(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Workspace</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingWorkspace?.name}"? This
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
