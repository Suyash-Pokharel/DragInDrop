"use client";

import { useState } from "react";
import { AlertCircle, Plus, TrendingUp } from "lucide-react";
import { useModal } from "@/app/components/ModalProvider";
import OAuthProviderStats from "./OAuthProviderStats";
import RegistrationTrendChart from "./RegistrationTrendChart";
import RecentUsersList from "./RecentUsersList";
import AllUsersModal from "./AllUsersModal";
import UserDetailsModal from "./UserDetailsModal";
import DeleteConfirmationModal from "./DeleteConfirmationModal";

// Interface matching Prisma query shape from the API
export interface UserWithAccounts {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  emailVerified: Date | null;
  createdAt: Date;
  role: "USER" | "ADMIN";
  Account: {
    provider: string;
    providerAccountId: string;
  }[];
  SocialAccount: {
    platform: string;
    platformAccountId: string;
    platformUsername: string | null;
    isActive: boolean;
  }[];
}

interface AdminDashboardProps {
  initialUsers: UserWithAccounts[];
}

export default function AdminDashboard({ initialUsers }: AdminDashboardProps) {
  // Modal hook
  const modal = useModal();
  
  // State management
  const [users, setUsers] = useState<UserWithAccounts[]>(initialUsers);
  const [showAllUsersModal, setShowAllUsersModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<UserWithAccounts | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Delete user functionality
  const deleteUser = async () => {
    if (!selectedUser) return;

    setIsDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/admin/users/${selectedUser.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to delete user");
      }

      // Success: filter deleted user from users array
      const updatedUsers = users.filter((u) => u.id !== selectedUser.id);
      setUsers(updatedUsers);

      // Close modals and reset selectedUser
      setShowDeleteConfirm(false);
      setSelectedUser(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-10 pb-16 relative z-0">
      {/* Ambient Background Glows - Enhanced for better visibility */}
      <div className="absolute top-0 left-1/4 w-full max-w-[100vw] h-[400px] bg-primary/20 rounded-full blur-[140px] -z-10 pointer-events-none"></div>
      <div className="absolute top-[500px] right-0 w-[500px] h-[500px] bg-secondary/15 rounded-full blur-[120px] -z-10 pointer-events-none"></div>
      <div className="absolute top-[200px] left-0 w-[600px] h-[300px] bg-primary/10 rounded-full blur-[100px] -z-10 pointer-events-none"></div>
      
      {/* Error Display Component */}
      {error && (
        <div className="mb-6 bg-error/10 border border-error/40 text-error px-5 py-4 rounded-xl flex items-start gap-3 backdrop-blur-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Empty State - No users registered yet */}
      {users.length === 0 ? (
        <div className="flex flex-col items-center justify-center min-h-[60vh] bg-surface/60 backdrop-blur-xl border border-border rounded-[2rem] p-8">
          <div className="text-center space-y-3">
            <div className="w-16 h-16 mx-auto bg-surface-highlight rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-text-secondary" />
            </div>
            <h3 className="text-xl font-semibold text-text-main">No users registered yet</h3>
            <p className="text-text-secondary max-w-md">
              When users register for the application, they will appear here.
            </p>
          </div>
        </div>
      ) : (
        <>
          {/* Header & Quick Actions */}
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 relative z-10 mb-10">
            <div>
              {/* Status Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-surface-highlight border border-border rounded-full text-xs font-semibold text-text-secondary tracking-wider uppercase mb-4 shadow-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-success"></span>
                </span>
                System Online
              </div>
              
              {/* Gradient Title */}
              <h2 className="text-4xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-text-main to-text-secondary">
                Welcome back, Admin.
              </h2>
              <p className="text-text-secondary mt-2 text-lg">Manage users and monitor platform activity</p>
            </div>
            
            {/* Create New Post Button */}
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

          <div className="relative z-10">
            <OAuthProviderStats users={users} />
          </div>

          {/* Main Grid Layout - 3:2 ratio (60% Registration / 40% Recent Users) */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-8 mt-6 relative z-10">
            {/* Left Column - Registration Trend Chart (3/5 = 60%) */}
            <div className="md:col-span-3 bg-surface/50 backdrop-blur-xl border border-border rounded-[2rem] p-6 md:p-8 flex flex-col hover:border-primary/30 transition-colors">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-xl font-bold flex items-center gap-2 text-text-main">
                    <TrendingUp className="text-primary w-6 h-6" />
                    Registration Trends
                  </h3>
                  <p className="text-sm text-text-secondary mt-1">New user signups over the last 7 days</p>
                </div>
                <span className="text-xs font-bold text-text-secondary bg-surface border border-border px-4 py-1.5 rounded-full shadow-sm">
                  Last 7 Days
                </span>
              </div>
              <div className="flex-1">
                <RegistrationTrendChart users={users} />
              </div>
            </div>

            {/* Right Column - Recent Users List (2/5 = 40%) */}
            <div className="md:col-span-2 bg-surface/50 backdrop-blur-xl border border-border rounded-[2rem] p-6 md:p-8 flex flex-col hover:border-primary/30 transition-colors">
              <RecentUsersList
                users={users}
                onViewAll={() => setShowAllUsersModal(true)}
                onSelectUser={(user) => setSelectedUser(user)}
              />
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <AllUsersModal
        users={users}
        isOpen={showAllUsersModal}
        isTopModal={!selectedUser && !showDeleteConfirm}
        onClose={() => setShowAllUsersModal(false)}
        onSelectUser={(user) => {
          setSelectedUser(user);
        }}
      />

      {selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          isOpen={!!selectedUser}
          isTopModal={!showDeleteConfirm}
          onClose={() => setSelectedUser(null)}
          onDelete={() => {
            setShowDeleteConfirm(true);
          }}
        />
      )}

      {selectedUser && (
        <DeleteConfirmationModal
          user={selectedUser}
          isOpen={showDeleteConfirm}
          isTopModal={true}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={deleteUser}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
