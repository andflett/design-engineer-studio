import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface UserRowProps {
  name: string;
  email: string;
  role: string;
  status: "active" | "inactive" | "pending";
}

const statusVariant: Record<string, "default" | "secondary" | "outline"> = {
  active: "default",
  inactive: "outline",
  pending: "secondary",
};

export function UserRow({ name, email, role, status }: UserRowProps) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("");

  return (
    <li className="flex items-center justify-between py-3">
      <span className="flex items-center gap-3">
        <Avatar>
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <span className="flex flex-col">
          <span className="text-sm font-medium">{name}</span>
          <span className="text-xs text-muted-foreground">{email}</span>
        </span>
      </span>
      <span className="flex items-center gap-3">
        <span className="text-xs text-muted-foreground">{role}</span>
        <Badge variant={statusVariant[status]}>{status}</Badge>
        <Button variant="ghost" size="sm">
          Edit
        </Button>
      </span>
    </li>
  );
}
