import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Users, Building2, Activity } from "lucide-react";
import {
  useAccountsOrganizationsList,
  useAccountsMembershipsList,
} from "@/client/gen/dashy/accounts/accounts";
import {
  useBiDashboardsList,
  useBiIndicatorsList,
} from "@/client/gen/dashy/bi/bi";
import { Skeleton } from "@/components/ui/skeleton";

export function DashboardPage() {
  const { data: organizations, isLoading: orgsLoading } =
    useAccountsOrganizationsList();
  const { data: memberships, isLoading: membersLoading } =
    useAccountsMembershipsList();
  const { data: dashboards, isLoading: dashboardsLoading } =
    useBiDashboardsList();
  const { data: indicators, isLoading: indicatorsLoading } =
    useBiIndicatorsList();

  const orgCount = organizations?.length ?? 0;
  const memberCount = memberships?.length ?? 0;
  const dashboardCount = dashboards?.length ?? 0;
  const indicatorCount = indicators?.length ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Welcome to Dashy - your Business Intelligence platform.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Organizations
            </CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {orgsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{orgCount}</div>
            )}
            <p className="text-xs text-muted-foreground">
              Organizations in the system
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {membersLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{memberCount}</div>
            )}
            <p className="text-xs text-muted-foreground">Active memberships</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dashboards</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {dashboardsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{dashboardCount}</div>
            )}
            <p className="text-xs text-muted-foreground">Created dashboards</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Indicators</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {indicatorsLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <div className="text-2xl font-bold">{indicatorCount}</div>
            )}
            <p className="text-xs text-muted-foreground">Active indicators</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No recent activity to display.
            </p>
          </CardContent>
        </Card>
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-sm text-muted-foreground">
              Get started by creating your first organization or dashboard.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
