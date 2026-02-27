import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface UserProfileProps {
  initials: string;
  name: string;
  role: string;
}

export function UserProfile({ initials, name, role }: UserProfileProps) {
  return (
    <figure data-slot="user-profile" className="flex items-center gap-3">
      <Avatar size="lg">
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <figcaption>
        <p className="text-sm font-medium">{name}</p>
        <p className="text-xs text-muted-foreground">{role}</p>
      </figcaption>
    </figure>
  );
}
