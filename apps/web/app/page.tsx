export default function HomePage() {
  return (
    <main className="min-h-screen">
      <div className="container mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold text-center mb-8">
          Welcome to IndianWalls
        </h1>
        <p className="text-xl text-center text-gray-600 mb-12">
          AI-powered property due diligence reports for Indian real estate
        </p>
        <div className="flex justify-center gap-4">
          <a href="/reports/new" className="btn-primary">
            Create Report
          </a>
          <a href="/pricing" className="btn-secondary">
            View Pricing
          </a>
        </div>
      </div>
    </main>
  );
}
