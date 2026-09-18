import * as React from "react";
import { Link, useLocation } from "react-router";

import { NavUser } from "~/components/nav-user";
import { NavAdmin } from "~/components/nav-admin";
import { NavReviews } from "~/components/nav-reviews";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from "~/components/ui/sidebar";
import { useCurrentUser } from "~/api/queries/useCurrentUser";

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const user = useCurrentUser();
  const location = useLocation();
  const isAdmin = user.data?.role === "admin";

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/dashboard">
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                  <img src="/brand.svg" alt="ReviewDesk" className="size-5" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">ReviewDesk</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Code review as a service
                  </span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavReviews currentPath={location.pathname} />
        <NavAdmin isAdmin={isAdmin} currentPath={location.pathname} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            email: user.data?.email || "",
            name: user.data?.name || "",
            avatar: user.data?.image || ""
          }}
        />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
