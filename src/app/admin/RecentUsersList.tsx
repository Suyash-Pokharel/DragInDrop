"use client";

import { useMemo } from "react";
import { UserWithAccounts } from "./AdminDashboard";
import { Users } from "lucide-react";

interface RecentUsersListProps {
  users: UserWithAccounts[];
  onViewAll: () => void;
}

export default function RecentUsersList({
  users,
  onViewAll,
}: RecentUsersListProps) {
  // Get 5 most recent users (already sorted by createdAt desc)
  const recentUsers = useMemo(() => users.slice(0, 5), [users]);

  return (
    <div
      onClick={onViewAll}
      className="cursor-pointer hover:bg-surface-highlight transition-colors rounded-3xl p-4 -m-4"
    >
      {/* Header with total user count */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-main">Recent Users</h3>
        <div className="flex items-center gap-2 text-text-secondary">
          <Users className="w-4 h-4" />
          <span className="text-sm font-medium">
            {users.length} {users.length === 1 ? "user" : "users"}
          </span>
        </div>
      </div>

      {/* User List */}
      <div className="space-y-3 max-h-[295px]">
        {recentUsers.length === 0 ? (
          <p className="text-text-secondary text-sm text-center py-8">
            No users registered yet
          </p>
        ) : (
          recentUsers.map((user) => {
            const oauthCount = user.socialAccounts.length;

            return (
              <div
                key={user.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-b-0"
              >
                {/* User Name */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-main truncate">
                    {user.name || "Unnamed User"}
                  </p>
                  <p className="text-xs text-text-secondary truncate">
                    {user.email}
                  </p>
                </div>

                {/* OAuth Provider Count Badge */}
                <div className="flex-shrink-0 ml-3">
                  <div
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      oauthCount > 0
                        ? "bg-primary/10 text-primary"
                        : "bg-surface border border-border text-text-secondary"
                    }`}
                  >
                    {oauthCount} {oauthCount === 1 ? "provider" : "providers"}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Click hint */}
      {recentUsers.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-text-secondary text-center">
            Click to view all users
          </p>
        </div>
      )}
    </div>
  );
}
