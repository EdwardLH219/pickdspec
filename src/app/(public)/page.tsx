import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-2xl">
            P
          </div>
        </div>
        <h1>Pick&apos;d Review Intelligence</h1>
        <p className="text-muted-foreground">
          Transform customer reviews into actionable insights. Monitor, analyze,
          and improve your reputation across all locations.
        </p>
        <Button asChild size="lg" className="w-full">
          <Link href="/dashboard">Enter Dashboard</Link>
        </Button>
      </div>
    </main>
  );
}
