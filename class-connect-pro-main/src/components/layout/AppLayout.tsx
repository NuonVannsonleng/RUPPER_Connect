import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

/**
 * Top-level shell used by all authenticated routes.
 * Provides sidebar + header and renders the matched route inside <Outlet />.
 */
export default function AppLayout() {
  const location = useLocation();

  return (
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />

        <div className="flex flex-1 flex-col">
          <AppHeader />
          <main className="flex-1 overflow-hidden p-4 sm:p-6 lg:p-8">
            <div key={location.pathname} className="animate-page-switch">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
