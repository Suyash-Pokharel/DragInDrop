export default function DashboardPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold">Welcome to your Dashboard</h2>
      <p className="text-text-secondary">
        Your registration is complete and your account is ready.
      </p>
      <section className="mt-6 p-4 bg-surface border border-border rounded-lg">
        <h3 className="font-medium">Next steps</h3>
        <ul className="list-disc list-inside text-sm text-text-secondary mt-2">
          <li>Update your profile information.</li>
          <li>Upload a profile picture.</li>
          <li>Explore projects and features.</li>
        </ul>
      </section>
    </div>
  );
}
