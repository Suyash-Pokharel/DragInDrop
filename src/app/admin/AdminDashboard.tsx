"use client";

import { useState } from "react";
import { AlertCircle } from "lucide-react";
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
  accounts: {
    provider: string;
    providerAccountId: string;
  }[];
  socialAccounts: {
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
    <div className="w-full bg-background p-4 md:p-5 lg:p-8 relative">
      {/* Error Display Component */}
      {error && (
        <div className="mb-6 bg-error/10 border border-error/40 text-error px-5 py-4 rounded-2xl flex items-start gap-3 backdrop-blur-sm">
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
          <OAuthProviderStats users={users} />

          {/* Main Grid Layout - 3:2 ratio (60% Registration / 40% Recent Users) */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mt-6">
            {/* Left Column - Registration Trend Chart (3/5 = 60%) */}
            <div className="md:col-span-3 bg-surface/50 backdrop-blur-xl border border-border rounded-[2rem] p-6 md:p-8 flex flex-col hover:border-primary/30 transition-colors">
              <h3 className="text-xl font-bold text-text-main mb-2">Registration Trends</h3>
              <p className="text-sm text-text-secondary mb-6">New user signups over the last 7 days</p>
              <div className="flex-1">
                <RegistrationTrendChart users={users} />
              </div>
            </div>

            {/* Right Column - Recent Users List (2/5 = 40%) */}
            <div className="md:col-span-2 bg-surface/50 backdrop-blur-xl border border-border rounded-[2rem] p-6 md:p-8 flex flex-col hover:border-primary/30 transition-colors">
              <RecentUsersList
                users={users}
                onViewAll={() => setShowAllUsersModal(true)}
              />
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <AllUsersModal
        users={users}
        isOpen={showAllUsersModal}
        onClose={() => setShowAllUsersModal(false)}
        onSelectUser={(user) => {
          setSelectedUser(user);
          setShowAllUsersModal(false);
        }}
      />

      {selectedUser && (
        <UserDetailsModal
          user={selectedUser}
          isOpen={!!selectedUser}
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
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={deleteUser}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
