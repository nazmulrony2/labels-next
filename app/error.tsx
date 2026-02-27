"use client";

// ✅ কেন: Route-level error boundary (App Router feature)
export default function ErrorPage(props: Readonly<{ error: Error; reset: () => void }>) {
  return (
    <div className="p-6">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="mt-2 text-sm text-red-600">{props.error.message}</p>
      <button className="mt-4 rounded border px-3 py-2" onClick={props.reset}>
        Try again
      </button>
    </div>
  );
}