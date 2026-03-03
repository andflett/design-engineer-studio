"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/page-header";
import { SearchBar } from "@/components/search-bar";
import { UserCard } from "@/components/user-card";
import { Metric } from "@/components/metric";
import { ToggleRow } from "@/components/toggle-row";

export default function HomePage() {
  const [notifications, setNotifications] = useState(true);
  const [agreed, setAgreed] = useState(false);

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 space-y-5">
      <PageHeader title="Workspace" tag="Beta" description="Manage your team and deployments.">
        <Button variant="default">Deploy</Button>
      </PageHeader>
      <SearchBar placeholder="Search members, projects…" action="Go" />
      <Alert variant="warning" >
        <AlertTitle>API usage at 91%</AlertTitle>
        <AlertDescription >Consider upgrading before Friday.</AlertDescription>
      </Alert>
      <Metric label="Revenue" value="$48k" unit="MRR" progress={72} variant="gradient" />
      <UserCard initials="AC" name="Andrew Flett" role="Lead Designer" status="online" size="lg" shape="circle" />
      <ToggleRow label="Notifications" description="Receive push alerts" checked={notifications} onCheckedChange={setNotifications} />
      <Separator />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead>Role</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Commits</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell className="font-medium">Andrew Flett</TableCell>
            <TableCell>Engineering</TableCell>
            <TableCell><Badge variant="secondary" size="sm">Active</Badge></TableCell>
            <TableCell className="text-right font-mono">248</TableCell>
          </TableRow>
        </TableBody>
      </Table>
      <Tabs defaultValue="feedback">
        <TabsList>
          <TabsTrigger value="feedback">Feedback</TabsTrigger>
          <TabsTrigger value="loading">Loading</TabsTrigger>
        </TabsList>
        <TabsContent value="feedback">
          <Label htmlFor="msg">Message</Label>
          <Textarea id="msg" placeholder="What could we improve?" rows={2} />
        </TabsContent>
        <TabsContent value="loading">
          <Skeleton shape="line" className="w-48" />
        </TabsContent>
      </Tabs>
      <Card variant="outline" elevation="sm">
        <CardHeader>
          <CardTitle className="text-base">Confirm deployment</CardTitle>
          <CardDescription>This will push to production.</CardDescription>
        </CardHeader>
        <CardContent>
          <Input placeholder="Type project name to confirm" size="sm" />
        </CardContent>
        <CardFooter className="justify-between">
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={agreed} onCheckedChange={setAgreed} variant="destructive" size="lg" />
            I understand the risks
          </label>
          <Button variant="destructive" size="xs" disabled={!agreed}>Confirm</Button>
        </CardFooter>
      </Card>
    </main>
  );
}
