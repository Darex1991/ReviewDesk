import { Fragment, type ReactNode } from "react";
import { Link } from "react-router";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from "~/components/ui/breadcrumb";
import { Separator } from "~/components/ui/separator";
import { SidebarTrigger } from "~/components/ui/sidebar";

type Crumb = { label: string; to?: string };

export function DashboardHeader({
  crumbs,
  actions
}: {
  crumbs: Crumb[];
  actions?: ReactNode;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-2 border-b border-border/60 pr-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex min-w-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator
          orientation="vertical"
          className="mr-2 data-[orientation=vertical]:h-4"
        />
        <Breadcrumb>
          <BreadcrumbList>
            {crumbs.map((crumb, index) => {
              const isLast = index === crumbs.length - 1;
              return (
                <Fragment key={`${crumb.label}-${index}`}>
                  <BreadcrumbItem className={isLast ? "" : "hidden md:block"}>
                    {isLast || !crumb.to ? (
                      <BreadcrumbPage className="max-w-[40vw] truncate">
                        {crumb.label}
                      </BreadcrumbPage>
                    ) : (
                      <BreadcrumbLink asChild>
                        <Link to={crumb.to}>{crumb.label}</Link>
                      </BreadcrumbLink>
                    )}
                  </BreadcrumbItem>
                  {!isLast && <BreadcrumbSeparator className="hidden md:block" />}
                </Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
  );
}
