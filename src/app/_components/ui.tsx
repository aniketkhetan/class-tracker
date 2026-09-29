import type { ReactNode } from "react";

import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

// Every panel on the dashboard is a titled card with an optional action in the
// corner, so this wraps that shape rather than repeating it seven times.
export function Section({
  title,
  action,
  className,
  contentClassName,
  children,
}: {
  title?: string;
  action?: ReactNode;
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  return (
    // shrink-0 because the desktop columns are fixed-height flex
    // containers: without it the cards compress below their content and
    // overlap each other.
    <Card className={cn("shrink-0 gap-0 py-4", className)}>
      {(title || action) && (
        <CardHeader className="px-4 pb-3">
          {title && (
            <CardTitle className="text-xs font-semibold tracking-wider text-muted-foreground uppercase">
              {title}
            </CardTitle>
          )}
          {action && <CardAction>{action}</CardAction>}
        </CardHeader>
      )}
      <CardContent className={cn("px-4", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="py-6 text-center text-sm text-muted-foreground">{children}</p>
  );
}
