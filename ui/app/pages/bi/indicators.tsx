import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Activity,
  Check,
  ChevronsUpDown,
  PlusCircle,
} from "lucide-react";
import { toast } from "sonner";
import {
  useBiIndicatorsList,
  useBiIndicatorsCreate,
  useBiIndicatorsUpdate,
  useBiIndicatorsDestroy,
  getBiIndicatorsListQueryKey,
} from "@/client/gen/dashy/bi/bi";
import type { Indicator } from "@/client/gen/dashy";
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
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

const indicatorSchema = z.object({
  name: z.string().min(1, "Name is required").max(255),
  formula: z.string().min(1, "Formula is required"),
  frequency: z.string().min(1, "Frequency is required").max(100),
  category: z.coerce.number().min(1, "Category is required"),
  owner: z.coerce.number().optional().nullable(),
});

type IndicatorFormValues = z.infer<typeof indicatorSchema>;

const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
  { value: "yearly", label: "Yearly" },
  { value: "real-time", label: "Real-time" },
];

export function IndicatorsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(
    null
  );
  const [deletingIndicator, setDeletingIndicator] = useState<Indicator | null>(
    null
  );
  const [categoryPopoverOpen, setCategoryPopoverOpen] = useState(false);
  const [editCategoryPopoverOpen, setEditCategoryPopoverOpen] = useState(false);
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [newCategoryId, setNewCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [categoryCreatingFor, setCategoryCreatingFor] = useState<
    "create" | "edit"
  >("create");

  const { data: indicators, isLoading, error } = useBiIndicatorsList();

  // Extract unique categories from existing indicators
  const existingCategories = useMemo(() => {
    if (!indicators) return [];
    const categoryMap = new Map<number, string>();
    indicators.forEach((indicator) => {
      if (!categoryMap.has(indicator.category)) {
        categoryMap.set(indicator.category, `Category ${indicator.category}`);
      }
    });
    return Array.from(categoryMap.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }, [indicators]);

  const createMutation = useBiIndicatorsCreate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getBiIndicatorsListQueryKey(),
        });
        setIsCreateOpen(false);
        toast.success("Indicator created successfully");
      },
      onError: () => {
        toast.error("Failed to create indicator");
      },
    },
  });

  const updateMutation = useBiIndicatorsUpdate({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getBiIndicatorsListQueryKey(),
        });
        setEditingIndicator(null);
        toast.success("Indicator updated successfully");
      },
      onError: () => {
        toast.error("Failed to update indicator");
      },
    },
  });

  const deleteMutation = useBiIndicatorsDestroy({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: getBiIndicatorsListQueryKey(),
        });
        setDeletingIndicator(null);
        toast.success("Indicator deleted successfully");
      },
      onError: () => {
        toast.error("Failed to delete indicator");
      },
    },
  });

  const form = useForm<IndicatorFormValues>({
    resolver: zodResolver(indicatorSchema),
    defaultValues: {
      name: "",
      formula: "",
      frequency: "",
      category: 0,
      owner: user?.id ?? null,
    },
  });

  const editForm = useForm<IndicatorFormValues>({
    resolver: zodResolver(indicatorSchema),
  });

  const onCreateSubmit = (data: IndicatorFormValues) => {
    createMutation.mutate({ data: data as any });
  };

  const onEditSubmit = (data: IndicatorFormValues) => {
    if (editingIndicator) {
      updateMutation.mutate({ id: editingIndicator.id, data: data as any });
    }
  };

  const handleEdit = (indicator: Indicator) => {
    editForm.reset({
      name: indicator.name,
      formula: indicator.formula,
      frequency: indicator.frequency,
      category: indicator.category,
      owner: indicator.owner,
    });
    setEditingIndicator(indicator);
  };

  const handleDelete = () => {
    if (deletingIndicator) {
      deleteMutation.mutate({ id: deletingIndicator.id });
    }
  };

  const getFrequencyLabel = (frequency: string) => {
    return FREQUENCIES.find((f) => f.value === frequency)?.label || frequency;
  };

  if (error) {
    return (
      <Card>
        <CardContent className="py-10">
          <p className="text-center text-destructive">
            Failed to load indicators. Please try again.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Indicators</h1>
          <p className="text-muted-foreground">
            Define and manage your key performance indicators (KPIs).
          </p>
        </div>
        <Button
          onClick={() => {
            form.reset({
              name: "",
              formula: "",
              frequency: "",
              category: 0,
              owner: user?.id ?? null,
            });
            setIsCreateOpen(true);
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          Add Indicator
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Indicators</CardTitle>
          <CardDescription>
            A list of all indicators in the system.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : indicators && indicators.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Formula</TableHead>
                  <TableHead>Frequency</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {indicators.map((indicator) => (
                  <TableRow key={indicator.id}>
                    <TableCell className="font-medium">
                      {indicator.id}
                    </TableCell>
                    <TableCell>{indicator.name}</TableCell>
                    <TableCell className="max-w-xs truncate font-mono text-sm">
                      {indicator.formula}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {getFrequencyLabel(indicator.frequency)}
                      </Badge>
                    </TableCell>
                    <TableCell>Category #{indicator.category}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEdit(indicator)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeletingIndicator(indicator)}
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
              <Activity className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No indicators found.</p>
              <Button variant="link" onClick={() => setIsCreateOpen(true)}>
                Create your first indicator
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Indicator</DialogTitle>
            <DialogDescription>Define a new KPI or metric.</DialogDescription>
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
                      <Input placeholder="Indicator name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="formula"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Formula</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., SUM(revenue) / COUNT(transactions)"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FREQUENCIES.map((freq) => (
                          <SelectItem key={freq.value} value={freq.value}>
                            {freq.label}
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
                name="category"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Category</FormLabel>
                    <Popover
                      open={categoryPopoverOpen}
                      onOpenChange={setCategoryPopoverOpen}
                    >
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={categoryPopoverOpen}
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? existingCategories.find(
                                  (cat) => cat.id === field.value
                                )?.name || `Category ${field.value}`
                              : "Select category..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search category..." />
                          <CommandList>
                            <CommandEmpty>No category found.</CommandEmpty>
                            <CommandGroup heading="Existing Categories">
                              {existingCategories.map((category) => (
                                <CommandItem
                                  key={category.id}
                                  value={category.name}
                                  onSelect={() => {
                                    field.onChange(category.id);
                                    setCategoryPopoverOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === category.id
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {category.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            <CommandSeparator />
                            <CommandGroup>
                              <CommandItem
                                onSelect={() => {
                                  setCategoryPopoverOpen(false);
                                  setCategoryCreatingFor("create");
                                  setNewCategoryId("");
                                  setNewCategoryName("");
                                  setIsCreatingCategory(true);
                                }}
                              >
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Create new category
                              </CommandItem>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
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
        open={!!editingIndicator}
        onOpenChange={() => setEditingIndicator(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Indicator</DialogTitle>
            <DialogDescription>Update indicator details.</DialogDescription>
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
                      <Input placeholder="Indicator name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="formula"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Formula</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="e.g., SUM(revenue) / COUNT(transactions)"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="frequency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Frequency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select frequency" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FREQUENCIES.map((freq) => (
                          <SelectItem key={freq.value} value={freq.value}>
                            {freq.label}
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
                name="category"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel>Category</FormLabel>
                    <Popover
                      open={editCategoryPopoverOpen}
                      onOpenChange={setEditCategoryPopoverOpen}
                    >
                      <PopoverTrigger asChild>
                        <FormControl>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={editCategoryPopoverOpen}
                            className={cn(
                              "w-full justify-between",
                              !field.value && "text-muted-foreground"
                            )}
                          >
                            {field.value
                              ? existingCategories.find(
                                  (cat) => cat.id === field.value
                                )?.name || `Category ${field.value}`
                              : "Select category..."}
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </FormControl>
                      </PopoverTrigger>
                      <PopoverContent className="w-full p-0" align="start">
                        <Command>
                          <CommandInput placeholder="Search category..." />
                          <CommandList>
                            <CommandEmpty>No category found.</CommandEmpty>
                            <CommandGroup heading="Existing Categories">
                              {existingCategories.map((category) => (
                                <CommandItem
                                  key={category.id}
                                  value={category.name}
                                  onSelect={() => {
                                    field.onChange(category.id);
                                    setEditCategoryPopoverOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      field.value === category.id
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {category.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                            <CommandSeparator />
                            <CommandGroup>
                              <CommandItem
                                onSelect={() => {
                                  setEditCategoryPopoverOpen(false);
                                  setCategoryCreatingFor("edit");
                                  setNewCategoryId("");
                                  setNewCategoryName("");
                                  setIsCreatingCategory(true);
                                }}
                              >
                                <PlusCircle className="mr-2 h-4 w-4" />
                                Create new category
                              </CommandItem>
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingIndicator(null)}
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
        open={!!deletingIndicator}
        onOpenChange={() => setDeletingIndicator(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Indicator</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingIndicator?.name}"? This
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

      {/* Create Category Dialog */}
      <Dialog open={isCreatingCategory} onOpenChange={setIsCreatingCategory}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Category</DialogTitle>
            <DialogDescription>
              Enter a unique ID for the new category. This will be used to group
              related indicators.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <label htmlFor="category-id" className="text-sm font-medium">
                Category ID
              </label>
              <Input
                id="category-id"
                type="number"
                placeholder="e.g., 101"
                value={newCategoryId}
                onChange={(e) => setNewCategoryId(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Enter a unique numeric ID for this category.
              </p>
            </div>
            <div className="grid gap-2">
              <label htmlFor="category-name" className="text-sm font-medium">
                Category Name (Optional)
              </label>
              <Input
                id="category-name"
                placeholder="e.g., Financial KPIs"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                A descriptive name for reference (stored locally).
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCreatingCategory(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => {
                const categoryId = parseInt(newCategoryId);
                if (!categoryId || categoryId <= 0) {
                  toast.error("Please enter a valid category ID");
                  return;
                }
                if (categoryCreatingFor === "create") {
                  form.setValue("category", categoryId);
                } else {
                  editForm.setValue("category", categoryId);
                }
                setIsCreatingCategory(false);
                toast.success(`Category ${categoryId} selected`);
              }}
              disabled={!newCategoryId}
            >
              <PlusCircle className="mr-2 h-4 w-4" />
              Create & Select
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
