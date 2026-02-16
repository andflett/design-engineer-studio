import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

const stats = [
  { label: "Total Users", value: "2,847", change: "+12%" },
  { label: "Active Now", value: "184", change: "+3%" },
  { label: "Revenue", value: "$48,290", change: "+8%" },
  { label: "Conversion", value: "3.2%", change: "-0.4%" },
];

const recentItems = [
  { name: "Landing page redesign", status: "In Progress", priority: "High" },
  { name: "Auth flow update", status: "Complete", priority: "Medium" },
  { name: "Dashboard charts", status: "In Progress", priority: "High" },
  { name: "Settings page", status: "Pending", priority: "Low" },
  { name: "API documentation", status: "Complete", priority: "Medium" },
];

export default function DashboardPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Overview of your project metrics.
          </p>
        </div>
        <Button>Export Report</Button>
      </div>

      {/* Stats Grid */}
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-3xl">{stat.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge
                variant={
                  stat.change.startsWith("+") ? "default" : "destructive"
                }
              >
                {stat.change}
              </Badge>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Table */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Recent Items</CardTitle>
          <CardDescription>
            A list of recent tasks and their status.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
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
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
