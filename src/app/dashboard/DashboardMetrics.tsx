import { AlertTriangle } from "lucide-react";

interface DashboardMetricsProps {
    totalScheduled: number;
    totalPublished: number;
    totalFailed: number;
    totalDrafts: number;
    connectedNetworks: number;
    inactiveNetworks: number;
}

export default function DashboardMetrics({
    totalScheduled,
    totalPublished,
    totalFailed,
    totalDrafts,
    connectedNetworks,
    inactiveNetworks,
}: DashboardMetricsProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-6 relative z-10">
            {/* Card 1 */}
            <div className="group bg-surface/60 backdrop-blur-md border border-border p-6 rounded-3xl shadow-sm hover:-translate-y-1 transition-all duration-300 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors"></div>
                <h3 className="text-4xl font-black text-text-main mb-1">{totalScheduled}</h3>
                <p className="text-text-secondary text-sm font-medium">Scheduled Posts</p>
            </div>

            {/* Card 2 */}
            <div className="group bg-surface/60 backdrop-blur-md border border-border p-6 rounded-3xl shadow-sm hover:border-success/50 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-success/10 rounded-full blur-2xl group-hover:bg-success/20 transition-colors"></div>
                <h3 className="text-4xl font-black text-text-main mb-1">{totalPublished}</h3>
                <p className="text-text-secondary text-sm font-medium">Successfully Published</p>
            </div>

            {/* Card 3 */}
            <div className="group bg-surface/60 backdrop-blur-md border border-border p-6 rounded-3xl shadow-sm hover:border-error/50 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-error/10 rounded-full blur-2xl group-hover:bg-error/20 transition-colors"></div>
                <div className="flex items-end gap-3 mb-1">
                    <h3 className="text-4xl font-black text-text-main">{totalFailed}</h3>
                    {totalFailed > 0 && <span className="text-xs font-bold text-error bg-error/10 px-2 py-1 rounded-xl mb-2">Needs Attention</span>}
                </div>
                <p className="text-text-secondary text-sm font-medium">Failed Attempts</p>
            </div>

            {/* Card 4 - Draft Posts */}
            <div className="group bg-surface/60 backdrop-blur-md border border-border p-6 rounded-3xl shadow-sm hover:border-warning/50 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-warning/10 rounded-full blur-2xl group-hover:bg-warning/20 transition-colors"></div>
                <h3 className="text-4xl font-black text-text-main mb-1">{totalDrafts}</h3>
                <p className="text-text-secondary text-sm font-medium">Draft Posts</p>
            </div>

            {/* Card 5 - Connected Networks */}
            <div className="group bg-surface/60 backdrop-blur-md border border-border p-6 rounded-3xl shadow-sm hover:border-primary/30 transition-all duration-300 hover:-translate-y-1 relative overflow-hidden">
                <div className="absolute -right-10 -top-10 w-32 h-32 bg-text-secondary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-colors"></div>
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-4xl font-black text-text-main">{connectedNetworks}</h3>
                    {inactiveNetworks > 0 && (
                        <span className="flex items-center gap-1 text-xs font-bold text-warning bg-warning/10 px-2 py-1 rounded-xl">
                            <AlertTriangle size={14} /> {inactiveNetworks} Auth Expired
                        </span>
                    )}
                </div>
                <p className="text-text-secondary text-sm font-medium">Connected Networks</p>
            </div>
        </div>
    );
}
