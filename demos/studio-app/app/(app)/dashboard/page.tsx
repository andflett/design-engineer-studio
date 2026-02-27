"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { StatCard } from "@/components/stat-card";
import { UserRow } from "@/components/user-row";
import { NotificationItem } from "@/components/notification-item";

const stats = [
  { label: "Total Users", value: "2,847", change: "+12%", progress: 78 },
  { label: "Active Now", value: "184", change: "+3%", progress: 45 },
  { label: "Revenue", value: "$48,290", change: "+8%", progress: 62 },
  { label: "Conversion", value: "3.2%", change: "-0.4%", progress: 32 },
];

const recentItems = [
  { name: "Landing page redesign", status: "In Progress", priority: "High" },
  { name: "Auth flow update", status: "Complete", priority: "Medium" },
  { name: "Dashboard charts", status: "In Progress", priority: "High" },
  { name: "Settings page", status: "Pending", priority: "Low" },
  { name: "API documentation", status: "Complete", priority: "Medium" },
];

const topContributors = [
  { name: "Alice Chen", email: "alice@example.com", role: "47 commits", status: "active" as const },
  { name: "Bob Martinez", email: "bob@example.com", role: "32 commits", status: "active" as const },
  { name: "Carol Wu", email: "carol@example.com", role: "18 commits", status: "active" as const },
];

const recentActivity = [
  { initials: "AC", title: "Deployed v2.4.1", description: "Production deploy completed successfully", time: "5m ago" },
  { initials: "BM", title: "Merged PR #142", description: "Add dark mode support to dashboard", time: "32m ago" },
  { initials: "CW", title: "Created issue #89", description: "Mobile navigation needs overflow handling", time: "2h ago" },
];

export default function DashboardPage() {
  return (
    <article className="mx-auto max-w-5xl px-4 py-8">
      <header className="flex items-center justify-between">
        <hgroup>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your project metrics.
          </p>
        </hgroup>
        <Button>Export Report</Button>
      </header>

      {/* Stats Grid */}
      <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <StatCard key={stat.label} {...stat} />
        ))}
      </section>

      <Separator className="my-8" />

      {/* Alert */}
      <Alert variant="success">
        <AlertTitle>Sprint on track</AlertTitle>
        <AlertDescription>
          3 of 5 items completed. 2 in progress with no blockers.
        </AlertDescription>
      </Alert>

      {/* Tabbed section */}
      <section className="mt-8">
        <Tabs defaultValue="tasks">
          <TabsList>
            <TabsTrigger value="tasks">Tasks</TabsTrigger>
            <TabsTrigger value="contributors">Contributors</TabsTrigger>
            <TabsTrigger value="activity">Activity</TabsTrigger>
          </TabsList>

          <TabsContent value="tasks">
            <Card>
              <CardHeader>
                <CardTitle>Recent Tasks</CardTitle>
                <CardDescription>
                  A list of recent tasks and their status.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="pb-3 font-medium text-muted-foreground">
                        Name
                      </th>
                      <th className="pb-3 font-medium text-muted-foreground">
                        Status
                      </th>
                      <th className="pb-3 font-medium text-muted-foreground">
                        Priority
                      </th>
                      <th className="pb-3 font-medium text-muted-foreground">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentItems.map((item) => (
                      <tr key={item.name} className="border-b last:border-0">
                        <td className="py-3 font-medium">{item.name}</td>
                        <td className="py-3">
                          <Badge
                            variant={
                              item.status === "Complete"
                                ? "default"
                                : item.status === "In Progress"
                                  ? "secondary"
                                  : "outline"
                            }
                          >
                            {item.status}
                          </Badge>
                        </td>
                        <td className="py-3 text-muted-foreground">
                          {item.priority}
                        </td>
                        <td className="py-3">
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
              <CardFooter>
                <Progress value={60} className="flex-1" />
                <span className="ml-3 text-xs text-muted-foreground">60% complete</span>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="contributors">
            <Card>
              <CardHeader>
                <CardTitle>Top Contributors</CardTitle>
                <CardDescription>
                  Most active team members this sprint.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-none divide-y p-0">
                  {topContributors.map((member) => (
                    <UserRow key={member.email} {...member} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="activity">
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
                <CardDescription>
                  Latest updates from your team.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="list-none divide-y p-0">
                  {recentActivity.map((item) => (
                    <NotificationItem key={item.title} {...item} />
                  ))}
                </ul>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </section>
    </article>
  );
}
