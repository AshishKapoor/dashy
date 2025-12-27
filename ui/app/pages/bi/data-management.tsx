import { useEffect, useMemo, useRef, useState, type ReactElement } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Database,
  RefreshCw,
  Hash,
  CalendarClock,
  Braces,
  Type,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock,
  FileText,
} from "lucide-react";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  useBiIotList,
  useBiIngestionJobsList,
  useBiIngestionJobsRetrieve,
  getBiIngestionJobsListQueryKey,
} from "@/client/gen/dashy/bi/bi";
import type { IngestionJob } from "@/client/gen/dashy";
import { AXIOS_INSTANCE } from "@/client/http-dashy-client";

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

const statusBadgeVariant = (
  status: string
): "default" | "secondary" | "destructive" | "outline" => {
  switch (status) {
    case "completed":
      return "default";
    case "processing":
      return "secondary";
    case "failed":
      return "destructive";
    default:
      return "outline";
  }
};

const StatusIcon = ({ status }: { status: string }) => {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="h-4 w-4 text-green-500" />;
    case "processing":
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case "failed":
      return <XCircle className="h-4 w-4 text-destructive" />;
    default:
      return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

export function DataManagementPage() {
  const queryClient = useQueryClient();
  const [rows, setRows] = useState<IoTMeasurement[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [metric, setMetric] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Fetch ingestion jobs
  const { data: jobs, refetch: refetchJobs } = useBiIngestionJobsList({
    query: {
      refetchInterval: activeJobId ? 2000 : false, // Poll while a job is active
    },
  });

  // Poll active job for progress
  const { data: activeJob } = useBiIngestionJobsRetrieve(activeJobId ?? "", {
    query: {
      enabled: !!activeJobId,
      refetchInterval: 1000, // Poll every second while active
    },
  });

  // Track when active job completes
  useEffect(() => {
    if (activeJob && activeJobId) {
      if (activeJob.status === "completed") {
        toast.success(
          `Ingestion completed: ${activeJob.processed_rows} records created`
        );
        setActiveJobId(null);
        refetch();
        refetchJobs();
      } else if (activeJob.status === "failed") {
        toast.error(
          `Ingestion failed: ${activeJob.error_message || "Unknown error"}`
        );
        setActiveJobId(null);
        refetchJobs();
      }
    }
  }, [activeJob, activeJobId, refetch, refetchJobs]);

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

  const handleUpload = async (file: File | null) => {
    if (!file) return;

    setIsUploading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      // Use axios directly for FormData upload to async endpoint
      const response = await AXIOS_INSTANCE.post<IngestionJob>(
        "/api/bi/iot/ingest/",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      const job = response.data;
      toast.info(`Ingestion job started: ${job.file_name}`);
      setActiveJobId(job.id);

      // Refresh jobs list
      queryClient.invalidateQueries({
        queryKey: getBiIngestionJobsListQueryKey(),
      });
    } catch (error: any) {
      const errorMsg = error?.response?.data?.error || "Upload failed";
      toast.error(errorMsg);
    } finally {
      setIsUploading(false);
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Recent jobs (last 5)
  const recentJobs = jobs?.slice(0, 5) ?? [];

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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upload Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-4 w-4" /> Upload Data
            </CardTitle>
            <CardDescription>
              Upload CSV or JSON files. Large files are processed in the
              background.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="device">Device ID (filter)</Label>
                <Input
                  id="device"
                  value={deviceId}
                  onChange={(e) => setDeviceId(e.target.value)}
                  placeholder="dev-1"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="metric">Metric (filter)</Label>
                <Input
                  id="metric"
                  value={metric}
                  onChange={(e) => setMetric(e.target.value)}
                  placeholder="temperature"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="file">CSV or JSON File</Label>
                <Input
                  ref={fileInputRef}
                  id="file"
                  type="file"
                  accept=".csv,.json,application/json,text/csv"
                  onChange={(e) => handleUpload(e.target.files?.[0] || null)}
                  disabled={isUploading}
                />
              </div>
            </div>

            {/* Active job progress */}
            {activeJob && activeJobId && (
              <div className="p-4 border rounded-lg bg-muted/50">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="font-medium">
                      Processing: {activeJob.file_name}
                    </span>
                  </div>
                  <Badge variant={statusBadgeVariant(activeJob.status)}>
                    {activeJob.status}
                  </Badge>
                </div>
                <Progress value={activeJob.progress} className="h-2" />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>
                    {activeJob.processed_rows} / {activeJob.total_rows} rows
                  </span>
                  <span>{activeJob.progress}%</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Jobs Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" /> Recent Jobs
            </CardTitle>
          </CardHeader>
          <CardContent>
            {recentJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No recent ingestion jobs
              </p>
            ) : (
              <div className="space-y-3">
                {recentJobs.map((job) => (
                  <div
                    key={job.id}
                    className="flex items-center gap-3 p-2 rounded-md hover:bg-muted/50 transition-colors"
                  >
                    <StatusIcon status={job.status} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {job.file_name || "Unknown file"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {job.processed_rows} rows •{" "}
                        {job.created_at
                          ? new Date(job.created_at).toLocaleString()
                          : ""}
                      </p>
                    </div>
                    <Badge
                      variant={statusBadgeVariant(job.status)}
                      className="shrink-0"
                    >
                      {job.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Data Preview Card */}
      <Card className="relative">
        <CardHeader>
          <CardTitle>Dataset Preview</CardTitle>
          <CardDescription>
            Showing {rows.length} records
            {deviceId && ` for device: ${deviceId}`}
            {metric && ` with metric: ${metric}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Overlay loader during refetch */}
          {isFetching && !isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
              <div className="flex items-center gap-2 px-4 py-2 rounded-md border bg-card">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Refreshing dataset...</span>
              </div>
            </div>
          )}
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <Database className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">No data found</p>
              <p className="text-sm text-muted-foreground">
                Upload a CSV or JSON file to get started
              </p>
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
