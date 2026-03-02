import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const skeletonVariants = cva(
  "bg-muted",
  {
    variants: {
      animation: {
        pulse: "animate-pulse",
        none: "",
      },
      shape: {
        line: "h-4 rounded",
        circle: "rounded-full aspect-square",
        rect: "rounded-md",
      },
    },
    defaultVariants: {
      animation: "pulse",
      shape: "rect",
    },
  }
);

function Skeleton({
  className,
  animation,
  shape,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & VariantProps<typeof skeletonVariants>) {
  return (
    <div
      data-slot="skeleton"
      className={cn(skeletonVariants({ animation, shape }), className)}
      {...props}
    />
  );
}

export { Skeleton, skeletonVariants };
