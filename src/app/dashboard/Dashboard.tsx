"use client";

import { useEffect, useState, useCallback } from "react";
import { 
  BarChart3, 
  Plus, 
  AlertTriangle
} from "lucide-react";
import DashboardActivityChart from "./DashboardActivityChart";
import DashboardMetrics from "./DashboardMetrics";
import ConnectedPlatforms from "./ConnectedPlatforms";
import UpcomingQueue from "./UpcomingQueue";
import { useModal } from "@/app/components/ModalProvider";

type DashboardData = {
  totalScheduled: number;
  totalPublished: number;
  totalFailed: number;
  totalDrafts: number;
  connectedNetworks: number;
  inactiveNetworks: number;
  socialAccounts: Array<{
    id: string;
    platform: string;
    isActive: boolean;
  }>;
  upcomingPosts: Array<{
    id: string;
    title: string | null;
    status: string;
    scheduledFor: Date;
    platformPosts: Array<{
      id: string;
      socialAccount: {
        platform: string;
      };
    }>;
  }>;
  draftPosts: Array<{
    id: string;
    title: string | null;
    description: string | null;
    videoFileName: string | null;
    createdAt: Date;
  }>;
  chartData: Array<{
    date: string;
    posts: number;
  }>;
  userName: string;
};

type UserPreferences = {
  dateFormat: string;
  timeFormat: string;
  firstDayOfWeek: string;
  timezone: string | null;
};

/**
 * Client component for Dashboard page.
 * Handles data fetching, state management, and rendering of dashboard UI.
 * Displays metrics, charts, connected platforms, and upcoming posts.
 */
export default function Dashboard() {
  const modal = useModal();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Function to manually trigger a refresh
  const refreshDashboard = useCallback(() => {
    setRefreshTrigger(prev => prev + 1);
  }, []);

  // Expose refresh function globally for modals to call
  useEffect(() => {
    if (typeof window !== 'undefined') {
      (window as Window & { refreshDashboard?: () => void }).refreshDashboard = refreshDashboard;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete (window as Window & { refreshDashboard?: () => void }).refreshDashboard;
      }
    };
  }, [refreshDashboard]);

  useEffect(() => {
    // Fetch dashboard data and user preferences in parallel
    Promise.all([
      fetch("/api/dashboard").then(res => res.json()),
      fetch("/api/user/preferences").then(res => res.json())
    ])
      .then(([dashboardData, preferences]) => {
        console.log("Dashboard data received:", dashboardData);
        console.log("Preferences received:", preferences);
        
        // Check if API returned an error
        if (dashboardData.error) {
          console.error("Dashboard API error:", dashboardData.error);
          setError(dashboardData.error);
          setLoading(false);
          return;
        }
        
        setDashboardData(dashboardData);
        setUserPreferences(preferences);
        setLoading(false);
      })
      .catch(error => {
        console.error("Failed to fetch dashboard data:", error);
        setError(error.message || "Failed to load dashboard");
        setLoading(false);
      });
  }, [refreshTrigger]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 bg-error/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-8 h-8 text-error" />
          </div>
          <h3 className="text-xl font-bold text-text-main mb-2">Failed to Load Dashboard</h3>
          <p className="text-text-secondary mb-4">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="px-6 py-2 bg-primary text-white rounded-xl hover:bg-primary/90 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-text-secondary">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const {
    totalScheduled = 0,
    totalPublished = 0,
    totalFailed = 0,
    totalDrafts = 0,
    connectedNetworks = 0,
    inactiveNetworks = 0,
    socialAccounts = [],
    upcomingPosts = [],
    draftPosts = [],
    chartData = [],
    userName
  } = dashboardData;

  return (
    <div className="space-y-10 pb-8 load-step-2 relative">
      
      {/* Ambient Background Glows - Enhanced for better visibility */}
      <div className="absolute top-0 left-1/4 w-full max-w-[100vw] h-[400px] bg-primary/20 rounded-full blur-[140px] -z-10 pointer-events-none"></div>
      <div className="absolute top-[500px] right-0 w-[500px] h-[500px] bg-secondary/15 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
      <div className="absolute top-[200px] left-0 w-[600px] h-[300px] bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>

      {/* Header & Quick Actions */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-highlight border border-border rounded-full text-xs font-semibold text-text-secondary tracking-wider uppercase mb-4 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
            </span>
            System Online
          </div>
          <h2 className="text-4xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-text-main to-text-secondary">
            Welcome back, {userName?.split(" ")[0] || "Creator"}.
          </h2>
          <p className="text-text-secondary mt-2 text-lg">Here&apos;s your command center overview for today.</p>
        </div>
        <div className="flex w-full md:w-auto">
          <button 
            onClick={() => modal.openUpload()}
            className="w-full md:w-auto flex items-center justify-center gap-2 bg-gradient-to-r from-primary to-secondary text-white px-8 py-3.5 rounded-xl font-bold hover:shadow-glow hover:-translate-y-1 transition-all duration-300 group overflow-hidden relative"
          >
            <div className="absolute inset-0 bg-white/20 w-full translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700 skew-x-12"></div>
            <Plus size={20} className="group-hover:rotate-90 transition-transform duration-300" />
            <span>Create New Post</span>
          </button>
        </div>
      </div>

      {/* High-Level Metrics */}
      <DashboardMetrics
        totalScheduled={totalScheduled}
        totalPublished={totalPublished}
        totalFailed={totalFailed}
        totalDrafts={totalDrafts}
        connectedNetworks={connectedNetworks}
        inactiveNetworks={inactiveNetworks}
      />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-8 relative z-10">
        
        {/* Main Column: Activity Graph & Platform Health */}
        <div className="xl:col-span-3 space-y-8">
          
          {/* Chart Section */}
          <section className="bg-surface/50 backdrop-blur-xl border border-border p-6 md:p-8 rounded-[2rem] shadow-sm relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent dark:from-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"></div>
            <div className="flex justify-between items-center mb-6 relative z-10">
              <div>
                <h3 className="text-xl font-bold flex items-center gap-2 text-text-main">
                  <BarChart3 className="text-primary w-6 h-6" />
                  Publishing Activity
                </h3>
                <p className="text-sm text-text-secondary mt-1">Your content creation and scheduling activity</p>
              </div>
              <span className="text-xs font-bold text-text-secondary bg-surface border border-border px-4 py-1.5 rounded-full shadow-sm">Last 7 Days</span>
            </div>
            
            <DashboardActivityChart data={chartData} />
          </section>

          {/* Platform Connections Banner */}
          <ConnectedPlatforms socialAccounts={socialAccounts} />
        </div>

        {/* Side Column: Timeline */}
        <div className="xl:col-span-2">
          <UpcomingQueue
            draftPosts={draftPosts}
            upcomingPosts={upcomingPosts}
            userTimezone={userPreferences?.timezone || null}
          />
        </div>
      </div>
    </div>
  );
}
