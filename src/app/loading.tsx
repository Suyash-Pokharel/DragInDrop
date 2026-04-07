export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] bg-background">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      <p className="mt-4 text-text-secondary">Loading content...</p>
    </div>
  );
}
