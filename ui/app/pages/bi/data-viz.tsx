import { useState, useMemo, useCallback } from "react";
import ReactECharts from "echarts-for-react";
import { toast } from "sonner";
import {
  Play,
  Table as TableIcon,
  LineChart,
  BarChart3,
  PieChart,
  ScatterChart,
  AreaChart,
  HelpCircle,
  Copy,
  Loader2,
  Code,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

import {
  useBiVizQueryCreate,
  useBiVizSchemaRetrieve,
} from "@/client/gen/dashy/bi/bi";
import type { SQLQueryResult, TableSchema } from "@/client/gen/dashy";

type ChartType = "table" | "line" | "bar" | "pie" | "scatter" | "area";

interface ChartConfig {
  xAxis: string;
  yAxis: string;
  groupBy?: string;
}

const CHART_ICONS: Record<ChartType, typeof TableIcon> = {
  table: TableIcon,
  line: LineChart,
  bar: BarChart3,
  pie: PieChart,
  scatter: ScatterChart,
  area: AreaChart,
};

const DEFAULT_QUERY = `SELECT 
  device_id,
  metric,
  AVG(value) as avg_value,
  COUNT(*) as count
FROM bi_iotmeasurement
GROUP BY device_id, metric
ORDER BY count DESC
LIMIT 100`;

export function DataVizPage() {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [chartType, setChartType] = useState<ChartType>("table");
  const [chartConfig, setChartConfig] = useState<ChartConfig>({
    xAxis: "",
    yAxis: "",
    groupBy: "",
  });
  const [queryResult, setQueryResult] = useState<SQLQueryResult | null>(null);
  const [schemaOpen, setSchemaOpen] = useState(false);

  const { data: schema, isLoading: schemaLoading } = useBiVizSchemaRetrieve();

  const queryMutation = useBiVizQueryCreate({
    mutation: {
      onSuccess: (data) => {
        setQueryResult(data);
        // Auto-select chart axes if possible
        if (data.columns && data.columns.length >= 2) {
          setChartConfig({
            xAxis: data.columns[0],
            yAxis: data.columns[1],
            groupBy: data.columns.length > 2 ? data.columns[2] : "",
          });
        }
        toast.success(`Query returned ${data.count} rows`);
      },
      onError: (error: unknown) => {
        const err = error as { response?: { data?: { error?: string } } };
        const errorMsg =
          err?.response?.data?.error || "Failed to execute query";
        toast.error(errorMsg);
      },
    },
  });

  const handleExecute = useCallback(() => {
    if (!query.trim()) {
      toast.error("Please enter a query");
      return;
    }
    queryMutation.mutate({ data: { query, limit: 1000 } });
  }, [query, queryMutation]);

  const handleExampleQuery = useCallback((exampleQuery: string) => {
    setQuery(exampleQuery);
    toast.info("Example query loaded");
  }, []);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("Copied to clipboard");
  }, []);

  // Build ECharts option based on chart type and config
  const chartOption = useMemo(() => {
    if (!queryResult || !queryResult.rows || queryResult.rows.length === 0) {
      return null;
    }

    const { xAxis, yAxis, groupBy } = chartConfig;
    if (!xAxis || !yAxis) return null;

    const rows = queryResult.rows as Record<string, unknown>[];

    // For pie charts
    if (chartType === "pie") {
      const data = rows.map((row) => ({
        name: String(row[xAxis] ?? ""),
        value: Number(row[yAxis]) || 0,
      }));
      return {
        tooltip: {
          trigger: "item",
          formatter: "{a} <br/>{b}: {c} ({d}%)",
        },
        legend: {
          orient: "vertical",
          left: "left",
          type: "scroll",
        },
        series: [
          {
            name: yAxis,
            type: "pie",
            radius: ["40%", "70%"],
            avoidLabelOverlap: true,
            itemStyle: {
              borderRadius: 10,
              borderColor: "#fff",
              borderWidth: 2,
            },
            label: {
              show: false,
              position: "center",
            },
            emphasis: {
              label: {
                show: true,
                fontSize: 20,
                fontWeight: "bold",
              },
            },
            labelLine: {
              show: false,
            },
            data,
          },
        ],
      };
    }

    // For line, bar, area, scatter
    if (groupBy && rows.some((r) => r[groupBy] !== undefined)) {
      // Grouped series
      const groups = [...new Set(rows.map((r) => String(r[groupBy] ?? "")))];
      const xValues = [...new Set(rows.map((r) => String(r[xAxis] ?? "")))];

      const series = groups.map((group) => ({
        name: group,
        type: chartType === "area" ? "line" : chartType,
        areaStyle: chartType === "area" ? {} : undefined,
        smooth: chartType === "line" || chartType === "area",
        data: xValues.map((x) => {
          const row = rows.find(
            (r) => String(r[xAxis]) === x && String(r[groupBy]) === group
          );
          return row ? Number(row[yAxis]) || 0 : 0;
        }),
      }));

      return {
        tooltip: {
          trigger: "axis",
          axisPointer: { type: chartType === "bar" ? "shadow" : "cross" },
        },
        legend: {
          data: groups,
          type: "scroll",
          bottom: 0,
        },
        grid: {
          left: "3%",
          right: "4%",
          bottom: "15%",
          containLabel: true,
        },
        xAxis: {
          type: "category",
          data: xValues,
          axisLabel: { rotate: 45, interval: 0 },
        },
        yAxis: { type: "value" },
        series,
      };
    }

    // Simple series (no grouping)
    const xData = rows.map((r) => String(r[xAxis] ?? ""));
    const yData = rows.map((r) => Number(r[yAxis]) || 0);

    if (chartType === "scatter") {
      return {
        tooltip: { trigger: "item" },
        xAxis: { type: "value", name: xAxis },
        yAxis: { type: "value", name: yAxis },
        series: [
          {
            type: "scatter",
            data: rows.map((r) => [
              Number(r[xAxis]) || 0,
              Number(r[yAxis]) || 0,
            ]),
            symbolSize: 10,
          },
        ],
      };
    }

    return {
      tooltip: {
        trigger: "axis",
        axisPointer: { type: chartType === "bar" ? "shadow" : "cross" },
      },
      grid: {
        left: "3%",
        right: "4%",
        bottom: "15%",
        containLabel: true,
      },
      xAxis: {
        type: "category",
        data: xData,
        axisLabel: { rotate: 45, interval: 0 },
      },
      yAxis: { type: "value" },
      series: [
        {
          name: yAxis,
          type: chartType === "area" ? "line" : chartType,
          areaStyle: chartType === "area" ? {} : undefined,
          smooth: chartType === "line" || chartType === "area",
          data: yData,
          itemStyle: {
            borderRadius: chartType === "bar" ? [4, 4, 0, 0] : 0,
          },
        },
      ],
    };
  }, [queryResult, chartType, chartConfig]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Data Viz</h1>
          <p className="text-muted-foreground">
            Query your IoT data with SQL and visualize with charts.
          </p>
        </div>
      </div>

      {/* Schema Reference Collapsible */}
      <Collapsible open={schemaOpen} onOpenChange={setSchemaOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base">
                  <HelpCircle className="h-4 w-4" />
                  Table Schema & Example Queries
                </CardTitle>
                {schemaOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="space-y-4">
              {schemaLoading ? (
                <Skeleton className="h-40 w-full" />
              ) : schema ? (
                <div className="grid md:grid-cols-2 gap-6">
                  {/* Column Schema */}
                  <div>
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Code className="h-4 w-4" />
                      Table: {(schema as TableSchema).table_name}
                    </h4>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Column</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Description</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(
                            (schema as TableSchema).columns as Array<{
                              name: string;
                              type: string;
                              description: string;
                            }>
                          )?.map((col) => (
                            <TableRow key={col.name}>
                              <TableCell className="font-mono text-sm">
                                {col.name}
                              </TableCell>
                              <TableCell>
                                <Badge variant="secondary">{col.type}</Badge>
                              </TableCell>
                              <TableCell className="text-muted-foreground text-sm">
                                {col.description}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Example Queries */}
                  <div>
                    <h4 className="font-medium mb-2">Example Queries</h4>
                    <ScrollArea className="h-[300px]">
                      <div className="space-y-2">
                        {(
                          (schema as TableSchema).example_queries as Array<{
                            description: string;
                            query: string;
                          }>
                        )?.map((example, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-lg border bg-muted/30"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-sm font-medium">
                                {example.description}
                              </span>
                              <div className="flex gap-1">
                                <TooltipProvider>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() =>
                                          copyToClipboard(example.query)
                                        }
                                      >
                                        <Copy className="h-3 w-3" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Copy</TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 text-xs"
                                  onClick={() =>
                                    handleExampleQuery(example.query)
                                  }
                                >
                                  Use
                                </Button>
                              </div>
                            </div>
                            <pre className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">
                              {example.query}
                            </pre>
                          </div>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* SQL Editor */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            SQL Query Editor
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="query">Enter your SQL query (SELECT only)</Label>
            <Textarea
              id="query"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SELECT * FROM bi_iotmeasurement LIMIT 100"
              className="font-mono text-sm min-h-[150px]"
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  handleExecute();
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Press ⌘+Enter or Ctrl+Enter to execute
            </p>
          </div>
          <div className="flex items-center justify-between">
            <Button
              onClick={handleExecute}
              disabled={queryMutation.isPending || !query.trim()}
            >
              {queryMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Execute Query
            </Button>
            {queryResult && (
              <Badge variant="outline">
                {queryResult.count} rows • {queryResult.columns?.length || 0}{" "}
                columns
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Results & Visualization */}
      {queryResult && queryResult.rows && queryResult.rows.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Results</CardTitle>
              <div className="flex items-center gap-2">
                {/* Chart Type Selector */}
                {(Object.keys(CHART_ICONS) as ChartType[]).map((type) => {
                  const Icon = CHART_ICONS[type];
                  return (
                    <TooltipProvider key={type}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant={chartType === type ? "default" : "outline"}
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setChartType(type)}
                          >
                            <Icon className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent className="capitalize">
                          {type}
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs
              value={chartType === "table" ? "table" : "chart"}
              className="w-full"
            >
              <TabsList className="mb-4">
                <TabsTrigger
                  value="table"
                  onClick={() => setChartType("table")}
                >
                  <TableIcon className="h-4 w-4 mr-2" />
                  Table
                </TabsTrigger>
                <TabsTrigger
                  value="chart"
                  onClick={() => chartType === "table" && setChartType("bar")}
                >
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Chart
                </TabsTrigger>
              </TabsList>

              <TabsContent value="table">
                <ScrollArea className="h-[400px]">
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {queryResult.columns?.map((col) => (
                            <TableHead key={col}>{col}</TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(
                          queryResult.rows as Array<Record<string, unknown>>
                        ).map((row, idx) => (
                          <TableRow key={idx}>
                            {queryResult.columns?.map((col) => (
                              <TableCell
                                key={col}
                                className="font-mono text-sm"
                              >
                                {row[col] === null
                                  ? "-"
                                  : typeof row[col] === "object"
                                  ? JSON.stringify(row[col])
                                  : String(row[col])}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="chart">
                {/* Chart Configuration */}
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="space-y-2">
                    <Label>X-Axis / Labels</Label>
                    <Select
                      value={chartConfig.xAxis}
                      onValueChange={(v) =>
                        setChartConfig((c) => ({ ...c, xAxis: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {queryResult.columns?.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Y-Axis / Values</Label>
                    <Select
                      value={chartConfig.yAxis}
                      onValueChange={(v) =>
                        setChartConfig((c) => ({ ...c, yAxis: v }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select column" />
                      </SelectTrigger>
                      <SelectContent>
                        {queryResult.columns?.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Group By (optional)</Label>
                    <Select
                      value={chartConfig.groupBy || ""}
                      onValueChange={(v) =>
                        setChartConfig((c) => ({
                          ...c,
                          groupBy: v === "_none" ? "" : v,
                        }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="None" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="_none">None</SelectItem>
                        {queryResult.columns?.map((col) => (
                          <SelectItem key={col} value={col}>
                            {col}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Chart */}
                {chartOption ? (
                  <div className="h-[400px] w-full">
                    <ReactECharts
                      option={chartOption}
                      style={{ height: "100%", width: "100%" }}
                      notMerge={true}
                      lazyUpdate={true}
                    />
                  </div>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-muted-foreground">
                    Select X-Axis and Y-Axis columns to visualize data
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!queryResult && !queryMutation.isPending && (
        <Card>
          <CardContent className="py-16">
            <div className="flex flex-col items-center justify-center text-center">
              <BarChart3 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">No data yet</h3>
              <p className="text-muted-foreground mb-4">
                Write a SQL query and click Execute to visualize your IoT data.
              </p>
              <Button variant="outline" onClick={() => setSchemaOpen(true)}>
                <HelpCircle className="mr-2 h-4 w-4" />
                View Schema & Examples
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
