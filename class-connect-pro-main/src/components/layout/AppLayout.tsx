import { Outlet, useLocation } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { AppHeader } from "./AppHeader";

/** Shared with RouteTransition, which resets this element on navigation. */
export const APP_SCROLL_ID = "app-scroll";

/**
 * Top-level shell used by all authenticated routes.
 *
 * The shell is exactly one viewport tall and does not scroll; `main` is the only thing that
 * does. The header is therefore a plain flex sibling that is always at the top, with no
 * `position: sticky` involved at all.
 *
 * That is deliberate. Sticky was being asked to hold a bar against the top of the document
 * scroller, and on iOS Safari - where the toolbars grow and shrink as you scroll and the
 * visual viewport moves independently of the layout viewport - it kept coming to rest partway
 * down the screen instead. An app shell that scrolls its own content sidesteps the whole
 * problem, and is what every messaging app does for the same reason.
 *
 * svh, not vh: `vh` on iOS means the *largest* viewport, so a `100vh` shell is taller than
 * what you can actually see whenever the toolbars are showing.
 */
export default function AppLayout() {
  const location = useLocation();

  return (
    <SidebarProvider defaultOpen>
      <div className="flex h-svh w-full overflow-hidden bg-background">
        <AppSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <AppHeader />
          {/* The app's scroller. RouteTransition finds it by id to reset it on navigation,
              since window.scrollTo no longer moves anything here. */}
          <main
            id={APP_SCROLL_ID}
            className="min-w-0 flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8"
          >
            <div key={location.pathname} className="animate-page-switch">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
