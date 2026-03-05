import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/components/ui/card";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

export function ComponentsPage() {
  const [checked, setChecked] = useState(false);
  const [switched, setSwitched] = useState(false);

  return (
    <div className="space-y-6">
      <Section title="Buttons">
        <div className="flex flex-wrap gap-2">
          {(["default", "secondary", "destructive", "outline", "ghost", "link"] as const).map(
            (v) => (
              <Button key={v} variant={v}>
                {v}
              </Button>
            )
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["xs", "sm", "default", "lg"] as const).map((s) => (
            <Button key={s} size={s}>
              Size {s}
            </Button>
          ))}
          <Button size="icon">+</Button>
        </div>
        <Button fullWidth>Full Width</Button>
      </Section>

      <Section title="Badges">
        <div className="flex flex-wrap gap-2">
          {(["default", "secondary", "destructive", "outline", "muted"] as const).map(
            (v) => (
              <Badge key={v} variant={v}>
                {v}
              </Badge>
            )
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {(["sm", "default", "lg"] as const).map((s) => (
            <Badge key={s} size={s}>
              Size {s}
            </Badge>
          ))}
        </div>
      </Section>

      <Section title="Inputs">
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="default-input">Default</Label>
            <Input id="default-input" placeholder="Type something..." />
          </div>
          <div className="flex gap-2">
            <Input size="sm" placeholder="Small" />
            <Input size="default" placeholder="Default" />
            <Input size="lg" placeholder="Large" />
          </div>
          <Input disabled placeholder="Disabled" />
        </div>
      </Section>

      <Section title="Textarea">
        <Textarea placeholder="Write a message..." />
        <Textarea disabled placeholder="Disabled textarea" />
      </Section>

      <Section title="Checkbox & Switch">
        <div className="flex items-center gap-2">
          <Checkbox checked={checked} onCheckedChange={setChecked} />
          <Label>Accept terms and conditions</Label>
        </div>
        <div className="flex flex-wrap gap-3">
          {(["sm", "default", "lg"] as const).map((s) => (
            <Checkbox key={s} size={s} checked />
          ))}
        </div>
        <Separator />
        <div className="flex items-center gap-2">
          <Switch checked={switched} onCheckedChange={setSwitched} />
          <Label>Enable notifications</Label>
        </div>
        <div className="flex flex-wrap gap-3">
          {(["sm", "default", "lg"] as const).map((s) => (
            <Switch key={s} size={s} checked />
          ))}
        </div>
      </Section>

      <Section title="Avatars">
        <div className="flex flex-wrap items-end gap-3">
          {(["xs", "sm", "default", "lg", "xl"] as const).map((s) => (
            <Avatar key={s} size={s} status="online">
              <AvatarFallback>AB</AvatarFallback>
            </Avatar>
          ))}
        </div>
        <div className="flex flex-wrap gap-3">
          <Avatar status="online">
            <AvatarFallback>ON</AvatarFallback>
          </Avatar>
          <Avatar status="away">
            <AvatarFallback>AW</AvatarFallback>
          </Avatar>
          <Avatar status="offline">
            <AvatarFallback>OF</AvatarFallback>
          </Avatar>
          <Avatar shape="square">
            <AvatarFallback>SQ</AvatarFallback>
          </Avatar>
        </div>
      </Section>

      <Section title="Progress">
        <div className="space-y-3">
          {(["sm", "default", "lg", "xl"] as const).map((s) => (
            <Progress key={s} size={s} value={60} />
          ))}
          <Progress value={80} variant="gradient" />
          <Progress value={40} variant="muted" />
        </div>
      </Section>

      <Section title="Alerts">
        <div className="space-y-3">
          {(["default", "destructive", "success", "warning"] as const).map((v) => (
            <Alert key={v} variant={v}>
              <AlertTitle className="capitalize">{v} Alert</AlertTitle>
              <AlertDescription>
                This is a {v} alert with a title and description.
              </AlertDescription>
            </Alert>
          ))}
          <Alert variant="destructive" border="left">
            <AlertTitle>Left Border</AlertTitle>
            <AlertDescription>Alert with left border style.</AlertDescription>
          </Alert>
        </div>
      </Section>

      <Section title="Skeleton">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <Skeleton shape="circle" className="h-12 w-12" />
            <div className="flex-1 space-y-2">
              <Skeleton shape="line" className="w-3/4" />
              <Skeleton shape="line" className="w-1/2" />
            </div>
          </div>
          <Skeleton shape="rect" className="h-32 w-full" />
        </div>
      </Section>
    </div>
  );
}
