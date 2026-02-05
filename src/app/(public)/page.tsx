import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gradient-to-b from-background to-muted/30">
      <div className="text-center space-y-6 max-w-md">
        <div className="flex justify-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-2xl">
            P
          </div>
        </div>
        <h1 className="text-3xl font-bold">Pick&apos;d Review Intelligence</h1>
        <p className="text-muted-foreground">
          Transform customer reviews into actionable insights. Monitor, analyze,
          and improve your reputation across all locations.
        </p>
        <div className="flex flex-col gap-3">
          <Button asChild size="lg" className="w-full">
            <Link href="/login">Sign In</Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="w-full">
            <Link href="/register">Create Account</Link>
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">
          Start your 14-day free trial. No credit card required.
        </p>
      </div>
    </main>
  );
}
