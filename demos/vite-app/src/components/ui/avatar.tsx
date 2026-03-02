import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const avatarVariants = cva(
  "relative flex shrink-0 overflow-hidden bg-muted",
  {
    variants: {
      size: {
        xs: "h-6 w-6 text-[10px]",
        sm: "h-8 w-8 text-xs",
        default: "h-10 w-10 text-sm",
        lg: "h-14 w-14 text-lg",
        xl: "h-20 w-20 text-xl",
      },
      shape: {
        circle: "rounded-full",
        square: "rounded-md",
      },
      status: {
        none: "",
        online: "",
        away: "",
        offline: "",
      },
    },
    defaultVariants: {
      size: "default",
      shape: "circle",
      status: "none",
    },
  }
);

const statusColors = {
  none: "",
  online: "bg-green-500",
  away: "bg-yellow-500",
  offline: "bg-muted-foreground",
} as const;

const Avatar = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement> & VariantProps<typeof avatarVariants>
>(({ className, size, shape, status, children, ...props }, ref) => (
  <span
    ref={ref}
    data-slot="avatar"
    className={cn(avatarVariants({ size, shape, status }), "relative", className)}
    {...props}
  >
    {children}
    {status && status !== "none" && (
      <span
        data-slot="avatar-status"
        className={cn(
          "absolute bottom-0 right-0 block rounded-full border-2 border-background",
          size === "xs" || size === "sm" ? "h-2 w-2" : "h-3 w-3",
          statusColors[status]
        )}
      />
    )}
  </span>
));
Avatar.displayName = "Avatar";

const AvatarImage = React.forwardRef<
  HTMLImageElement,
  React.ImgHTMLAttributes<HTMLImageElement>
>(({ className, ...props }, ref) => (
  <img
    ref={ref}
    data-slot="avatar-image"
    className={cn("aspect-square h-full w-full object-cover", className)}
    {...props}
  />
));
AvatarImage.displayName = "AvatarImage";

const AvatarFallback = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, ...props }, ref) => (
  <span
    ref={ref}
    data-slot="avatar-fallback"
    className={cn(
      "flex h-full w-full items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground",
      className
    )}
    {...props}
  />
));
AvatarFallback.displayName = "AvatarFallback";

export { Avatar, AvatarImage, AvatarFallback };
