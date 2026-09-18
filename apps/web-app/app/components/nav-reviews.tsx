import { LayoutDashboard, ListChecks, Plus, type LucideIcon } from "lucide-react";
import { Link } from "react-router";

import {
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem
} from "~/components/ui/sidebar";

type NavItem = {
  title: string;
  to: string;
  icon: LucideIcon;
  isActive: (path: string) => boolean;
};

const ITEMS: NavItem[] = [
  {
    title: "Overview",
    to: "/dashboard",
    icon: LayoutDashboard,
    isActive: (path) => path === "/dashboard"
  },
  {
    title: "Reviews",
    to: "/dashboard/reviews",
    icon: ListChecks,
    isActive: (path) =>
      path.startsWith("/dashboard/reviews") && path !== "/dashboard/reviews/new"
  },
  {
    title: "New review",
    to: "/dashboard/reviews/new",
    icon: Plus,
    isActive: (path) => path === "/dashboard/reviews/new"
  }
];

export function NavReviews({ currentPath }: { currentPath: string }) {
  return (
    <SidebarGroup>
      <SidebarGroupLabel>Code review</SidebarGroupLabel>
      <SidebarMenu>
        {ITEMS.map((item) => (
          <SidebarMenuItem key={item.to}>
            <SidebarMenuButton
              asChild
              tooltip={item.title}
              isActive={item.isActive(currentPath)}
            >
              <Link to={item.to}>
                <item.icon className="size-4" />
                <span>{item.title}</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        ))}
      </SidebarMenu>
    </SidebarGroup>
  );
}
