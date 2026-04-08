import React from "react";
import { BellRing, Mail } from "lucide-react";

export default function NotificationsPage() {
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 ease-out flex flex-col gap-6 w-full max-w-3xl">
      <div className="mb-2">
        <h2 className="text-2xl font-semibold text-text-main mb-1">Notifications</h2>
        <p className="text-text-secondary text-sm md:text-base">Control how and when you receive alerts from DragInDrop.</p>
      </div>

      <div className="bg-surface border border-border rounded-2xl p-6 md:p-8 flex flex-col gap-8 shadow-sm">
        
        {/* Email Notifications */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <Mail className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium text-text-main">Email Notifications</h3>
          </div>
          
          <div className="flex flex-col gap-4 mt-2">
            
            {/* Toggle Item */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-medium text-text-main text-sm">Post Confirmation</h4>
                <p className="text-xs text-text-secondary mt-0.5">Receive an email when a scheduled post is successfully published.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer mt-1">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Toggle Item */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-medium text-text-main text-sm">Post Error Warnings</h4>
                <p className="text-xs text-text-secondary mt-0.5">Get notified immediately if a post fails to publish.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer mt-1">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {/* Toggle Item */}
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-medium text-text-main text-sm">Re-Authentication Required</h4>
                <p className="text-xs text-text-secondary mt-0.5">Alerts when a social account token expires and needs reconnecting.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer mt-1">
                <input type="checkbox" className="sr-only peer" defaultChecked />
                <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
            
          </div>
        </section>

        {/* In-App Notifications */}
        <section className="flex flex-col gap-4">
          <div className="flex items-center gap-2 border-b border-border pb-2">
            <BellRing className="w-5 h-5 text-primary" />
            <h3 className="text-lg font-medium text-text-main">In-App Alerts</h3>
          </div>
          
          <div className="flex flex-col gap-4 mt-2">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h4 className="font-medium text-text-main text-sm">Marketing & Updates</h4>
                <p className="text-xs text-text-secondary mt-0.5">Show notifications about new features and improvements.</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer mt-1">
                <input type="checkbox" className="sr-only peer" />
                <div className="w-9 h-5 bg-border peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-border after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}
