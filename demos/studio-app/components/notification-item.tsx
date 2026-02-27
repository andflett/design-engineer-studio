import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface NotificationItemProps {
  initials: string;
  title: string;
  description: string;
  time: string;
}

export function NotificationItem({
  initials,
  title,
  description,
  time,
}: NotificationItemProps) {
  return (
    <li className="flex items-start gap-3 py-2">
      <Avatar size="sm">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-sm font-medium">{title}</span>
        <span className="text-xs text-muted-foreground">{description}</span>
      </span>
      <time className="text-xs text-muted-foreground whitespace-nowrap">{time}</time>
    </li>
  );
}
