import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Loader2, Users } from "lucide-react";
import { toast } from "sonner";
import {
  useAccountsMembershipsList,
  useAccountsMembershipsCreate,
  useAccountsMembershipsUpdate,
  useAccountsMembershipsDestroy,
  useAccountsOrganizationsList,
  useAccountsRolesList,
  getAccountsMembershipsListQueryKey,
} from "@/client/gen/dashy/accounts/accounts";
import type { Membership } from "@/client/gen/dashy";
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

const membershipSchema = z.object({
  user: z.coerce.number().min(1, "User ID is required"),
  organization: z.coerce.number().min(1, "Organization is required"),
  role: z.coerce.number().min(1, "Role is required"),
});

type MembershipFormValues = z.infer<typeof membershipSchema>;

export function MembershipsPage() {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingMembership, setEditingMembership] = useState<Membership | null>(
    null
  );
  const [deletingMembership, setDeletingMembership] =
    useState<Membership | null>(null);

  const { data: memberships, isLoading, error } = useAccountsMembershipsList();
  const { data: organizations } = useAccountsOrganizationsList();
  const { data: roles } = useAccountsRolesList();

  const createMutation = useAccountsMembershipsCreate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getAccountsMembershipsListQueryKey(),
        });
        setIsCreateOpen(false);
        toast.success("Membership created successfully");
      },
      onError: () => {
        toast.error("Failed to create membership");
      },
    },
  });

  const updateMutation = useAccountsMembershipsUpdate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getAccountsMembershipsListQueryKey(),
        });
        setEditingMembership(null);
        toast.success("Membership updated successfully");
      },
      onError: () => {
        toast.error("Failed to update membership");
      },
    },
  });

  const deleteMutation = useAccountsMembershipsDestroy({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getAccountsMembershipsListQueryKey(),
        });
        setDeletingMembership(null);
        toast.success("Membership deleted successfully");
      },
      onError: () => {
        toast.error("Failed to delete membership");
      },
    },
  });

  const form = useForm<MembershipFormValues>({
    resolver: zodResolver(membershipSchema),
    defaultValues: {
      user: 0,
      organization: 0,
      role: 0,
    },
  });

  const editForm = useForm<MembershipFormValues>({
    resolver: zodResolver(membershipSchema),
  });

  const onCreateSubmit = (data: MembershipFormValues) => {
    createMutation.mutate({ data: data as any });
  };

  const onEditSubmit = (data: MembershipFormValues) => {
    if (editingMembership) {
      updateMutation.mutate({ id: editingMembership.id, data: data as any });
    }
  };

  const handleEdit = (membership: Membership) => {
    editForm.reset({
      user: membership.user,
      organization: membership.organization,
      role: membership.role,
    });
    setEditingMembership(membership);
  };

  const handleDelete = () => {
    if (deletingMembership) {
      deleteMutation.mutate({ id: deletingMembership.id });
    }
  };

  const getOrganizationName = (id: number) => {
    return organizations?.find((org) => org.id === id)?.name || `Org #${id}`;
  };

  const getRoleName = (id: number) => {
    return roles?.find((role) => role.id === id)?.name || `Role #${id}`;
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-center text-destructive">
            Failed to load memberships. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Memberships</h1>
          <p className="text-muted-foreground">
            Manage user memberships and their organization assignments.
          </p>
        </div>
        <Button
          onClick={() => {
            form.reset({ user: 0, organization: 0, role: 0 });
            setIsCreateOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Membership
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Memberships</CardTitle>
          <CardDescription>
            A list of all user memberships in organizations.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : memberships && memberships.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>User ID</TableHead>
                  <TableHead>Organization</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberships.map((membership) => (
                  <TableRow key={membership.id}>
                    <TableCell className="font-medium">
                      {membership.id}
                    </TableCell>
                    <TableCell>{membership.user}</TableCell>
                    <TableCell>
                      {getOrganizationName(membership.organization)}
                    </TableCell>
                    <TableCell>{getRoleName(membership.role)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(membership)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingMembership(membership)}
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
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No memberships found.</p>
              <Button variant="link" onClick={() => setIsCreateOpen(true)}>
                Create your first membership
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Membership</DialogTitle>
            <DialogDescription>
              Assign a user to an organization with a role.
            </DialogDescription>
          </DialogHeader>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onCreateSubmit)}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="user"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User ID</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter user ID"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 0)
                        }
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
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles?.map((role) => (
                          <SelectItem key={role.id} value={role.id.toString()}>
                            {role.name}
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
        open={!!editingMembership}
        onOpenChange={() => setEditingMembership(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Membership</DialogTitle>
            <DialogDescription>Update membership details.</DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form
              onSubmit={editForm.handleSubmit(onEditSubmit)}
              className="space-y-4"
            >
              <FormField
                control={editForm.control}
                name="user"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>User ID</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="Enter user ID"
                        {...field}
                        onChange={(e) =>
                          field.onChange(parseInt(e.target.value) || 0)
                        }
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
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(parseInt(value))}
                      value={field.value?.toString()}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles?.map((role) => (
                          <SelectItem key={role.id} value={role.id.toString()}>
                            {role.name}
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
                  onClick={() => setEditingMembership(null)}
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
        open={!!deletingMembership}
        onOpenChange={() => setDeletingMembership(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Membership</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this membership? This action
              cannot be undone.
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
