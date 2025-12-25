import { Outlet } from "react-router-dom";
import { BarChart3 } from "lucide-react";

export function AuthLayout() {
  return (
    <div className="min-h-screen flex">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary items-center justify-center p-12">
        <div className="max-w-md text-center text-primary-foreground">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-foreground text-primary">
              <BarChart3 className="h-6 w-6" />
            </div>
            <span className="text-3xl font-bold">Dashy</span>
          </div>
          <h1 className="text-2xl font-semibold mb-4">
            Business Intelligence Platform
          </h1>
          <p className="text-primary-foreground/80">
            Create stunning dashboards, track key indicators, and make
            data-driven decisions with Dashy's powerful analytics tools.
          </p>
        </div>
      </div>

      {/* Right side - Auth form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center justify-center gap-2 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <BarChart3 className="h-5 w-5" />
            </div>
            <span className="text-2xl font-bold">Dashy</span>
          </div>
          <Outlet />
        </div>
      </div>
    </div>
  );
}
