export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-64px)] bg-gray-50 dark:bg-navy-950">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      <p className="mt-4 text-gray-500 dark:text-gray-400">
        Loading content...
      </p>
    </div>
  );
}
