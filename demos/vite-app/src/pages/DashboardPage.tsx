import { StatCard } from "@/components/stat-card";
import { UserCard } from "@/components/user-card";
import { FeatureGrid } from "@/components/feature-grid";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

const stats = [
  { label: "Total Users", value: "2,847", change: "+12.5%", progress: 72 },
  { label: "Revenue", value: "$48.2k", change: "+8.1%", progress: 65 },
  { label: "Active Sessions", value: "1,024", change: "-2.3%", progress: 45 },
  { label: "Conversion", value: "3.6%", change: "+0.8%", progress: 36 },
];

const users = [
  { initials: "JD", name: "Jane Doe", role: "Admin", email: "jane@example.com", status: "online" as const },
  { initials: "AS", name: "Alex Smith", role: "Developer", email: "alex@example.com", status: "away" as const },
  { initials: "MJ", name: "Maria Johnson", role: "Designer", email: "maria@example.com", status: "online" as const },
  { initials: "TW", name: "Tom Wilson", role: "PM", email: "tom@example.com", status: "offline" as const },
];

const recentActivity = [
  { action: "Deployed v2.4.1", user: "Jane Doe", time: "2 min ago", status: "Success" },
  { action: "Updated tokens", user: "Maria Johnson", time: "15 min ago", status: "Success" },
  { action: "Build failed", user: "Alex Smith", time: "1 hr ago", status: "Error" },
  { action: "New PR #284", user: "Tom Wilson", time: "3 hr ago", status: "Pending" },
  { action: "Released beta", user: "Jane Doe", time: "5 hr ago", status: "Success" },
];

export function DashboardPage() {
  return (
    <div className="space-y-6">
      <Alert variant="destructive" border="left">
        <AlertTitle variant="destructive">Vite Plugin Active</AlertTitle>
        <AlertDescription>
          Source annotations and Surface component are being injected by @designtools/vite-plugin.
        </AlertDescription>
      </Alert>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.label} {...s} />
        ))}
      </div>
      <Tabs defaultValue="activity">
        <TabsList>
          <TabsTrigger value="activity">Recent Activity</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
        </TabsList>

        <TabsContent value="activity">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Action</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentActivity.map((row) => (
                <TableRow key={row.action}>
                  <TableCell className="font-medium">{row.action}</TableCell>
                  <TableCell>{row.user}</TableCell>
                  <TableCell className="text-muted-foreground">{row.time}</TableCell>
                  <TableCell>
                    <span
                      className={
                        row.status === "Success"
                          ? "text-success"
                          : row.status === "Error"
                            ? "text-destructive"
                            : "text-warning"
                      }
                    >
                      {row.status}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="team">
          <div className="grid gap-3 sm:grid-cols-2">
            {users.map((u) => (
              <UserCard key={u.name} {...u} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="features">
          <FeatureGrid />
        </TabsContent>
      </Tabs>
      <div className="space-y-3">
        <h3 className="text-sm font-medium text-muted-foreground">System Health</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span>CPU Usage</span>
            <span className="text-muted-foreground">42%</span>
          </div>
          <Progress value={42} variant="default" />
          <div className="flex items-center justify-between text-sm">
            <span>Memory</span>
            <span className="text-muted-foreground">68%</span>
          </div>
          <Progress value={68} variant="gradient" />
          <div className="flex items-center justify-between text-sm">
            <span>Disk</span>
            <span className="text-muted-foreground">23%</span>
          </div>
          <Progress value={23} variant="muted" />
        </div>
      </div>
    </div>
  );
}
