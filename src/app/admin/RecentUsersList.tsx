"use client";

import { useMemo } from "react";
import { UserWithAccounts } from "./AdminDashboard";
import { Users, ArrowRight } from "lucide-react";

interface RecentUsersListProps {
  users: UserWithAccounts[];
  onViewAll: () => void;
  onSelectUser?: (user: UserWithAccounts) => void;
}

export default function RecentUsersList({
  users,
  onViewAll,
  onSelectUser,
}: RecentUsersListProps) {
  // Get 5 most recent users (already sorted by createdAt desc)
  const recentUsers = useMemo(() => users.slice(0, 10), [users]);

  return (
    <div className="flex flex-col h-full rounded-3xl p-1">
      {/* Header with total user count */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold flex items-center gap-2 text-text-main">
            <Users className="text-secondary w-6 h-6" />
            Recent Users
          </h3>
          <p className="text-sm text-text-secondary mt-1">Latest platform registrations</p>
        </div>
        <span className="text-xs font-bold text-text-secondary bg-surface border border-border px-4 py-1.5 rounded-full shadow-sm hidden sm:inline-block">
          {users.length} {users.length === 1 ? "Total User" : "Total Users"}
        </span>
      </div>

      {/* User List */}
      <div className="space-y-3 max-h-[350px] overflow-y-auto custom-scrollbar pr-2 mb-2">
        {recentUsers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 opacity-70 bg-surface/40 rounded-2xl border border-border/50">
            <Users className="w-8 h-8 text-text-secondary mb-3" />
            <p className="text-text-main font-bold text-sm">No users registered yet</p>
          </div>
        ) : (
          recentUsers.map((user) => {
            const oauthCount = user.SocialAccount.length;

            return (
              <div
                key={user.id}
                onClick={onSelectUser ? () => onSelectUser(user) : undefined}
                className={`flex items-center justify-between p-3.5 bg-surface/30 backdrop-blur-md border border-border/60 rounded-xl relative overflow-hidden ${
                  onSelectUser ? "cursor-pointer hover:bg-surface/50 transition-colors hover:border-primary/30" : ""
                }`}
              >
                {/* Left side: Avatar + Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/10 to-secondary/10 border border-primary/20 flex items-center justify-center text-primary font-bold shadow-sm shrink-0 uppercase">
                    {user.name ? user.name.charAt(0) : "U"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-text-main truncate">
                      {user.name || "Unnamed User"}
                    </p>
                    <p className="text-xs text-text-secondary truncate">
                      {user.email}
                    </p>
                  </div>
                </div>

                {/* Right side: Badge */}
                <div className="flex items-center gap-3 shrink-0 ml-2">
                  <div
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider shadow-sm transition-colors ${
                      oauthCount > 0
                        ? "bg-primary/10 text-primary border border-primary/20"
                        : "bg-surface-highlight text-text-secondary border border-border"
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

      {/* Footer Button */}
      {users.length > 0 && (
        <div className="mt-auto pt-4 border-t border-border flex justify-center">
          <button 
            onClick={onViewAll}
            className="text-sm font-bold text-primary group-hover/btn:text-secondary flex items-center justify-center gap-2 hover:gap-3 transition-all cursor-pointer group"
          >
             Show All Users<ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}
    </div>
  );
}
