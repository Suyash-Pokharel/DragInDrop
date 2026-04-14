"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, CartesianGrid } from "recharts";
import { useState, useEffect, useMemo } from "react";
import { UserWithAccounts } from "./AdminDashboard";

interface RegistrationTrendChartProps {
  users: UserWithAccounts[];
}

export default function RegistrationTrendChart({ users }: RegistrationTrendChartProps) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
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
        registrations: registrationsByDate[dateKey] || 0,
      };
    });
  }, [users]);

  if (!chartData || chartData.length === 0) {
    return (
      <div className="h-[300px] w-full flex flex-col items-center justify-center border border-dashed border-border/50 rounded-2xl text-text-secondary mt-4 bg-surface/30 backdrop-blur-sm relative overflow-hidden group">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
        <div className="w-16 h-16 bg-surface-highlight rounded-full flex items-center justify-center mb-4 shadow-sm relative z-10">
          <svg className="w-8 h-8 text-text-secondary/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
             <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <span className="text-sm font-medium z-10">No registration activity yet.</span>
        <span className="text-xs text-text-secondary/70 z-10 mt-1">User registration trends will appear here once users sign up.</span>
      </div>
    );
  }

  if (!mounted) {
    return (
      <div className="h-[300px] w-full mt-6 relative z-10 flex items-center justify-center">
        <div className="animate-pulse text-text-secondary">Loading chart...</div>
      </div>
    );
  }

  return (
    <div className="h-[300px] w-full mt-6 relative z-10">
      <ResponsiveContainer width="100%" height={300}>
        <BarChart 
          data={chartData} 
          margin={{ top: 10, right: 10, left: -25, bottom: 0 }}
          onMouseMove={(state: any) => {
            if (state.isTooltipActive) setActiveIndex(state.activeTooltipIndex);
            else setActiveIndex(null);
          }}
          onMouseLeave={() => setActiveIndex(null)}
        >
          <defs>
            <linearGradient id="registrationBarGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
              <stop offset="100%" stopColor="var(--secondary)" stopOpacity={0.6} />
            </linearGradient>
            <linearGradient id="registrationBarGradientHover" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--primary)" stopOpacity={1} />
              <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.9} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" strokeOpacity={0.4} />
          <XAxis 
            dataKey="date" 
            stroke="var(--text-secondary)" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
            dy={10}
            className="font-medium"
          />
          <YAxis 
            stroke="var(--text-secondary)" 
            fontSize={12} 
            tickLine={false} 
            axisLine={false} 
            allowDecimals={false} 
            dx={-10}
            className="font-medium"
          />
          <Tooltip 
            cursor={false}
            contentStyle={{ 
              borderRadius: '12px', 
              border: '1px solid var(--border)', 
              backgroundColor: 'var(--surface)',
              color: 'var(--text-main)',
              boxShadow: '0 10px 30px -10px var(--shadow-color)',
              padding: '12px 16px',
            }}
            labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: 'var(--text-secondary)' }}
            itemStyle={{ color: 'var(--text-main)', fontWeight: 600 }}
          />
          <Bar 
            dataKey="registrations" 
            radius={[6, 6, 0, 0]} 
            maxBarSize={48} 
            animationDuration={1500}
            animationEasing="ease-out"
          >
            {chartData.map((entry, index) => (
              <Cell 
                key={`cell-${index}`} 
                fill={activeIndex === index ? "url(#registrationBarGradientHover)" : "url(#registrationBarGradient)"} 
                className="transition-all duration-300"
                style={{ filter: activeIndex === index ? "drop-shadow(0px 0px 8px var(--primary))" : "none" }}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
