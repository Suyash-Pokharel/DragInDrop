"use client";

import { useMemo, useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts";
import { UserWithAccounts } from "./AdminDashboard";

interface RegistrationTrendChartProps {
  users: UserWithAccounts[];
}

export default function RegistrationTrendChart({
  users,
}: RegistrationTrendChartProps) {
  // Get theme colors dynamically from CSS variables
  const [colors, setColors] = useState<{
    primary: string;
    textSecondary: string;
    surface: string;
    border: string;
    textMain: string;
  } | null>(null);

  useEffect(() => {
    // Read computed CSS variables from the document
    const updateColors = () => {
      const computedStyle = getComputedStyle(document.documentElement);
      
      setColors({
        primary: computedStyle.getPropertyValue("--primary").trim(),
        textSecondary: computedStyle.getPropertyValue("--text-secondary").trim(),
        surface: computedStyle.getPropertyValue("--surface").trim(),
        border: computedStyle.getPropertyValue("--border").trim(),
        textMain: computedStyle.getPropertyValue("--text-main").trim(),
      });
    };

    // Initial update
    updateColors();

    // Listen for theme changes (class changes on html/body)
    const observer = new MutationObserver(updateColors);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  // Calculate last 7 days registration data (rolling week)
  const chartData = useMemo(() => {
    // Generate array of last 7 days (including today)
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - i));
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
    return last7Days.map((date) => {
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
    <div className="w-full h-full min-h-[300px]">
      {colors && (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 20, left: -20, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke={colors.border}
              vertical={false}
            />
            <XAxis
              dataKey="date"
              stroke={colors.textSecondary}
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke={colors.textSecondary}
              fontSize={12}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              cursor={{ fill: "transparent" }}
              contentStyle={{
                backgroundColor: colors.surface,
                border: `1px solid ${colors.border}`,
                borderRadius: "8px",
                color: colors.textMain,
              }}
              labelStyle={{
                color: colors.textMain,
              }}
            />
            <Bar
              dataKey="count"
              fill={colors.primary}
              radius={[8, 8, 0, 0]}
              activeBar={{
                fill: colors.primary,
                opacity: 0.8,
              }}
            />
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
