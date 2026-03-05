import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

interface UserCardProps {
  initials: string;
  name: string;
  role: string;
  email: string;
  status?: "online" | "away" | "offline";
}

export function UserCard({
  initials,
  name,
  role,
  email,
  status = "online",
}: UserCardProps) {
  const statusVariant =
    status === "online"
      ? "default"
      : status === "away"
        ? "secondary"
        : "muted";

  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <Avatar size="lg" status={status}>
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{name}</p>
          <p className="text-xs text-muted-foreground truncate">{email}</p>
          <p className="text-xs text-muted-foreground">{role}</p>
        </div>
        <Badge variant={statusVariant} size="sm">
          {status}
        </Badge>
      </CardContent>
    </Card>
  );
}
