export default function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-[hsl(220,16%,19%)]">
      <nav className="bg-[hsl(222,16%,24%)] border-b border-[hsl(220,17%,28%)]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center space-x-8">
              <h1 className="text-xl font-semibold text-[hsl(193,43%,75%)]">
                RE Platform Admin
              </h1>
              <span className="text-sm text-[hsl(219,28%,88%)]">
                Internal Database Viewer
              </span>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  )
}