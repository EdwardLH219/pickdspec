"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  CreditCard,
  Zap,
  Users,
  Building,
  MessageSquare,
  CheckCircle,
  ExternalLink,
  Crown,
} from "lucide-react";

// Mock subscription data
const subscriptionData = {
  plan: "Professional",
  status: "active",
  billingCycle: "monthly",
  nextBillingDate: "2026-02-27",
  price: 299,
  currency: "USD",
  limits: {
    seats: { used: 6, limit: 10 },
    branches: { used: 2, limit: 5 },
    reviewsPerMonth: { used: 847, limit: 2000 },
  },
  features: [
    "Unlimited review imports",
    "AI-powered sentiment analysis",
    "Theme detection & tracking",
    "Automated recommendations",
    "Task management",
    "CSV/Excel exports",
    "Email reports",
    "Priority support",
  ],
};

const plans = [
  {
    name: "Starter",
    price: 99,
    description: "For small businesses",
    seats: 3,
    branches: 1,
    current: false,
  },
  {
    name: "Professional",
    price: 299,
    description: "For growing businesses",
    seats: 10,
    branches: 5,
    current: true,
  },
  {
    name: "Enterprise",
    price: null,
    description: "For large organizations",
    seats: "Unlimited",
    branches: "Unlimited",
    current: false,
  },
];

export function SubscriptionTab() {
  const handleManageBilling = () => {
    // In a real app, this would redirect to Stripe billing portal
    alert("This would redirect to the billing portal (Stripe, etc.)");
  };

  const handleUpgrade = () => {
    alert("This would open the upgrade flow");
  };

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-amber-500" />
                Current Plan
              </CardTitle>
              <CardDescription>
                Your subscription details and usage
              </CardDescription>
            </div>
            <Badge className="bg-emerald-100 text-emerald-700 text-sm px-3 py-1">
              {subscriptionData.status.charAt(0).toUpperCase() +
                subscriptionData.status.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Plan Overview */}
          <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-primary/5 to-primary/10 border">
            <div>
              <h3 className="text-2xl font-bold">{subscriptionData.plan}</h3>
              <p className="text-muted-foreground">
                ${subscriptionData.price}/{subscriptionData.billingCycle}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-muted-foreground">Next billing date</p>
              <p className="font-medium">
                {new Date(subscriptionData.nextBillingDate).toLocaleDateString(
                  "en-US",
                  { month: "long", day: "numeric", year: "numeric" }
                )}
              </p>
            </div>
          </div>

          {/* Usage Meters */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  Team Seats
                </span>
                <span className="font-medium">
                  {subscriptionData.limits.seats.used} /{" "}
                  {subscriptionData.limits.seats.limit}
                </span>
              </div>
              <Progress
                value={
                  (subscriptionData.limits.seats.used /
                    subscriptionData.limits.seats.limit) *
                  100
                }
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-muted-foreground" />
                  Branches
                </span>
                <span className="font-medium">
                  {subscriptionData.limits.branches.used} /{" "}
                  {subscriptionData.limits.branches.limit}
                </span>
              </div>
              <Progress
                value={
                  (subscriptionData.limits.branches.used /
                    subscriptionData.limits.branches.limit) *
                  100
                }
                className="h-2"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-muted-foreground" />
                  Reviews/mo
                </span>
                <span className="font-medium">
                  {subscriptionData.limits.reviewsPerMonth.used.toLocaleString()} /{" "}
                  {subscriptionData.limits.reviewsPerMonth.limit.toLocaleString()}
                </span>
              </div>
              <Progress
                value={
                  (subscriptionData.limits.reviewsPerMonth.used /
                    subscriptionData.limits.reviewsPerMonth.limit) *
                  100
                }
                className="h-2"
              />
            </div>
          </div>

          <Separator />

          {/* Features List */}
          <div>
            <h4 className="font-medium mb-3">Included Features</h4>
            <div className="grid gap-2 sm:grid-cols-2">
              {subscriptionData.features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={handleManageBilling}>
              <CreditCard className="mr-2 h-4 w-4" />
              Manage Billing
            </Button>
            <Button variant="outline" onClick={handleUpgrade}>
              <Zap className="mr-2 h-4 w-4" />
              Upgrade Plan
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Available Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Available Plans</CardTitle>
          <CardDescription>
            Compare plans and find the right fit for your business
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {plans.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-lg border p-5 ${
                  plan.current
                    ? "border-primary bg-primary/5 ring-1 ring-primary"
                    : ""
                }`}
              >
                {plan.current && (
                  <Badge className="absolute -top-2 right-4 bg-primary">
                    Current Plan
                  </Badge>
                )}
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold">{plan.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {plan.description}
                    </p>
                  </div>
                  <div>
                    {plan.price ? (
                      <p className="text-3xl font-bold">
                        ${plan.price}
                        <span className="text-base font-normal text-muted-foreground">
                          /mo
                        </span>
                      </p>
                    ) : (
                      <p className="text-3xl font-bold">Custom</p>
                    )}
                  </div>
                  <Separator />
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      {plan.seats} team seats
                    </li>
                    <li className="flex items-center gap-2">
                      <Building className="h-4 w-4 text-muted-foreground" />
                      {plan.branches} branches
                    </li>
                  </ul>
                  <Button
                    className="w-full"
                    variant={plan.current ? "outline" : "default"}
                    disabled={plan.current}
                  >
                    {plan.current
                      ? "Current Plan"
                      : plan.price
                      ? "Upgrade"
                      : "Contact Sales"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Billing History placeholder */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Billing History
          </CardTitle>
          <CardDescription>
            View and download your past invoices
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <div className="p-4 text-center text-muted-foreground">
              <p className="mb-2">Your billing history will appear here.</p>
              <Button variant="link" className="text-primary">
                View in billing portal
                <ExternalLink className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
