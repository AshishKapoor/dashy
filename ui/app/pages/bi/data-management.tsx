import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Database,
  Upload,
  RefreshCw,
  Hash,
  CalendarClock,
  Braces,
  Type,
  Loader2,
} from "lucide-react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useBiIotList, useBiIotIngestCreate } from "@/client/gen/dashy/bi/bi";
import type {
  BiIotIngestCreateBodyOne,
  BiIotIngestCreateBodyTwo,
} from "@/client/gen/dashy";

interface IoTMeasurement {
  id: number;
  organization: number;
  device_id: string;
  metric: string;
  recorded_at: string;
  value: number | null;
  tags?: Record<string, unknown> | null;
}

const typeIconFor = (key: string): ReactElement => {
  switch (key) {
    case "recorded_at":
      return <CalendarClock className="h-4 w-4 text-muted-foreground" />;
    case "value":
      return <Hash className="h-4 w-4 text-muted-foreground" />;
    case "tags":
      return <Braces className="h-4 w-4 text-muted-foreground" />;
    default:
      return <Type className="h-4 w-4 text-muted-foreground" />;
  }
};

export function DataManagementPage() {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<IoTMeasurement[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [metric, setMetric] = useState("");
  const tableContainerRef = useRef<HTMLDivElement>(null);

  const columns = useMemo<ColumnDef<IoTMeasurement>[]>(
    () => [
      {
        header: () => (
          <div className="flex items-center gap-2">
            {typeIconFor("device_id")}
            <span>Device</span>
          </div>
        ),
        accessorKey: "device_id",
      },
      {
        header: () => (
          <div className="flex items-center gap-2">
            {typeIconFor("metric")}
            <span>Metric</span>
          </div>
        ),
        accessorKey: "metric",
      },
      {
        header: () => (
          <div className="flex items-center gap-2">
            {typeIconFor("recorded_at")}
            <span>Recorded At</span>
          </div>
        ),
        accessorKey: "recorded_at",
        cell: ({ getValue }) => {
          const v = getValue() as string;
          try {
            const d = new Date(v);
            return d.toLocaleString();
          } catch {
            return v;
          }
        },
      },
      {
        header: () => (
          <div className="flex items-center gap-2">
            {typeIconFor("value")}
            <span>Value</span>
          </div>
        ),
        accessorKey: "value",
      },
      {
        header: () => (
          <div className="flex items-center gap-2">
            {typeIconFor("tags")}
            <span>Tags</span>
          </div>
        ),
        accessorKey: "tags",
        cell: ({ getValue }) => {
          const v = getValue() as Record<string, unknown> | null | undefined;
          return (
            <span className="text-muted-foreground text-xs">
              {v ? JSON.stringify(v) : "-"}
            </span>
          );
        },
      },
    ],
    []
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  const rowVirtualizer = useVirtualizer({
    count: table.getRowModel().rows.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 44,
    overscan: 10,
  });

  const { data, isLoading, isFetching, refetch } = useBiIotList(
    {
      device_id: deviceId || undefined,
      metric: metric || undefined,
    },
    {
      query: {
        staleTime: 1000 * 30,
      },
    }
  );

  useEffect(() => {
    const normalized = (data ?? []).map((d) => ({
      ...d,
      value: d.value ?? null,
    }));
    setRows(normalized);
  }, [data]);

  useEffect(() => {
    refetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId, metric]);

  const ingestMutation = useBiIotIngestCreate({
    mutation: {
      onSuccess: async () => {
        toast.success("File ingested successfully");
        // Invalidate all IoT queries to refresh data regardless of filters
        // Use the correct query key prefix from generated client
        await queryClient.invalidateQueries({
          queryKey: [`/api/bi/iot/`],
        });
        // Explicitly refetch the current view
        await refetch();
      },
      onError: (error: any) => {
        const errorMsg = error?.response?.data?.error || "Upload failed";
        toast.error(errorMsg);
      },
    },
  });

  const handleUpload = async (file: File | null) => {
    if (!file) return;
    const isJson =
      file.type === "application/json" ||
      file.name.toLowerCase().endsWith(".json");

    if (isJson) {
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const payload: BiIotIngestCreateBodyOne = Array.isArray(parsed)
          ? { rows: parsed }
          : (parsed as BiIotIngestCreateBodyOne);
        ingestMutation.mutate({ data: payload });
      } catch {
        toast.error("Invalid JSON file");
      }
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    // Cast FormData to expected union type for the generated client
    ingestMutation.mutate({
      data: formData as unknown as BiIotIngestCreateBodyTwo,
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Management</h1>
          <p className="text-muted-foreground">
            Ingest IoT datasets and browse time-series efficiently.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => refetch()}
          disabled={isLoading}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="h-4 w-4" /> Upload Data
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="device">Device ID (optional filter)</Label>
              <Input
                id="device"
                value={deviceId}
                onChange={(e) => setDeviceId(e.target.value)}
                placeholder="dev-1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="metric">Metric (optional filter)</Label>
              <Input
                id="metric"
                value={metric}
                onChange={(e) => setMetric(e.target.value)}
                placeholder="temperature"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="file">CSV or JSON (rows) Upload</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="file"
                  type="file"
                  accept=".csv,application/json"
                  onChange={(e) => handleUpload(e.target.files?.[0] || null)}
                  disabled={ingestMutation.isPending}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => refetch()}
                  disabled={isFetching || ingestMutation.isPending}
                >
                  {isFetching ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Load
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Dataset Preview</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Top progress bar during upload or refetch */}
          {(ingestMutation.isPending || isFetching) && (
            <div className="absolute top-0 left-0 right-0 h-1">
              <div className="h-full bg-primary/20" />
              <div className="absolute inset-0">
                <div className="h-full w-1/3 bg-primary/80 animate-pulse" />
              </div>
            </div>
          )}
          {/* Overlay loader during upload or refetch */}
          {(ingestMutation.isPending || isFetching) && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm">
              <div className="flex items-center gap-2 px-4 py-2 rounded-md border bg-card">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">
                  {ingestMutation.isPending
                    ? "Uploading and refreshing dataset..."
                    : "Refreshing dataset..."}
                </span>
              </div>
            </div>
          )}
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : (
            <div
              ref={tableContainerRef}
              className="relative rounded-md border h-[500px] overflow-auto"
            >
              <div
                style={{
                  height: `${rowVirtualizer.getTotalSize()}px`,
                  width: "100%",
                  position: "relative",
                }}
              >
                {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                  const row = table.getRowModel().rows[virtualRow.index];
                  return (
                    <div
                      key={row.id}
                      data-index={virtualRow.index}
                      ref={rowVirtualizer.measureElement}
                      className="flex border-b px-3 text-sm"
                      style={{
                        position: "absolute",
                        top: 0,
                        left: 0,
                        width: "100%",
                        transform: `translateY(${virtualRow.start}px)`,
                      }}
                    >
                      {row.getVisibleCells().map((cell) => (
                        <div key={cell.id} className="flex-1 py-2 pr-2">
                          {cell.column.columnDef.cell
                            ? flexRender(
                                cell.column.columnDef.cell,
                                cell.getContext()
                              )
                            : String(cell.getValue() ?? "")}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
