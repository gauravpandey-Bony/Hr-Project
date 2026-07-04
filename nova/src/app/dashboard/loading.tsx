export default function DashboardLoading() {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
      <div
        className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent"
        aria-hidden
      />
      <p className="text-sm text-muted-foreground">Loading…</p>
    </div>
  );
}
