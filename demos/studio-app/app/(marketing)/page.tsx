"use client";

import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Hero } from "@/components/hero";
import { UserProfile } from "@/components/user-profile";

export default function HomePage() {
  const [notifications, setNotifications] = useState(true);

  return (
    <article className="mx-auto max-w-2xl px-4 py-12 flex flex-col gap-6">
      <Hero />

      <UserProfile initials="AC" name="Alice Chen" role="Lead Designer" />

      <fieldset className="flex items-center justify-between">
        <Label>Notifications</Label>
        <Switch checked={notifications} onCheckedChange={setNotifications} />
      </fieldset>

      <Progress value={72} />

      <Alert variant="success">
        <AlertTitle>All systems operational</AlertTitle>
        <AlertDescription>Tokens and components are synced.</AlertDescription>
      </Alert>

      <Separator />

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <TabsContent value="overview">
          <p className="text-sm text-muted-foreground">
            48 components, 124 tokens, 94% coverage.
          </p>
        </TabsContent>
        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Quick Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure your workspace preferences.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <footer className="text-center text-sm text-muted-foreground">
        Run{" "}
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs font-mono">
          npx @designtools/codesurface
        </code>{" "}
        to start editing.
      </footer>
    </article>
  );
}
