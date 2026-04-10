"use client";

import { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { UserWithAccounts } from "./AdminDashboard";

interface RegistrationTrendChartProps {
  users: UserWithAccounts[];
}

export default function RegistrationTrendChart({
  users,
}: RegistrationTrendChartProps) {
  // Calculate last 30 days registration data
  const chartData = useMemo(() => {
    // Generate array of last 30 days
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      date.setHours(0, 0, 0, 0);
      return date;
    });

    // Group users by createdAt date and count registrations per day
    const registrationsByDate = users.reduce(
      (acc, user) => {
        const userDate = new Date(user.createdAt);
        userDate.setHours(0, 0, 0, 0);
        const dateKey = userDate.toISOString().split("T")[0];
        acc[dateKey] = (acc[dateKey] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    // Map to chart data format with "MMM DD" labels
    return last30Days.map((date) => {
      const dateKey = date.toISOString().split("T")[0];
      return {
        date: date.toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
        }),
        count: registrationsByDate[dateKey] || 0,
      };
    });
  }, [users]);

  return (
    <div className="w-full h-[300px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <XAxis
            dataKey="date"
            stroke="hsl(var(--text-secondary))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            stroke="hsl(var(--text-secondary))"
            fontSize={12}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--surface))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "8px",
              color: "hsl(var(--text-main))",
            }}
            labelStyle={{
              color: "hsl(var(--text-main))",
            }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ fill: "hsl(var(--primary))", r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
