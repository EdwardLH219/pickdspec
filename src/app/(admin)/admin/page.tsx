/**
 * Admin Console Page
 * 
 * Pick'd Admin only - for managing scoring parameters, tenants, and system settings.
 */

import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Settings, Users, Activity, Upload, Scale, Search, ClipboardList, DollarSign, MessageSquareWarning } from 'lucide-react';
import Link from 'next/link';

export default async function AdminPage() {
  const session = await auth();
  
  // Server-side authorization check
  if (!session?.user?.isPickdStaff || session.user.role !== 'PICKD_ADMIN') {
    redirect('/dashboard');
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="flex items-center gap-3 mb-8">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold">Admin Console</h1>
          <p className="text-muted-foreground">Pick&apos;d internal administration</p>
        </div>
        <Badge variant="default" className="ml-auto">PICKD_ADMIN</Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Parameter Management */}
        <Link href="/admin/parameters" className="block">
          <Card className="hover:border-primary transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Parameters
              </CardTitle>
              <CardDescription>
                Manage scoring algorithm parameters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create, edit, and activate parameter set versions that control how review scores are calculated.
              </p>
              <Badge variant="default" className="mt-4">Active</Badge>
            </CardContent>
          </Card>
        </Link>

        {/* Rules Management */}
        <Link href="/admin/rules" className="block">
          <Card className="hover:border-primary transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Scale className="h-5 w-5" />
                Rules
              </CardTitle>
              <CardDescription>
                Manage scoring rules
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Edit JSON rules for confidence scoring and data sufficiency with full versioning.
              </p>
              <Badge variant="default" className="mt-4">Active</Badge>
            </CardContent>
          </Card>
        </Link>

        {/* Economic Parameters */}
        <Link href="/admin/economics" className="block">
          <Card className="hover:border-primary transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Economic Weights
              </CardTitle>
              <CardDescription>
                Revenue &amp; footfall impact settings
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Configure theme economic weights, elasticity ranges, and ROI calculation parameters.
              </p>
              <Badge variant="default" className="mt-4">Active</Badge>
            </CardContent>
          </Card>
        </Link>

        {/* Score Runs */}
        <Link href="/admin/runs" className="block">
          <Card className="hover:border-primary transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                Score Runs
              </CardTitle>
              <CardDescription>
                Monitor scoring jobs
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View score run history, trigger manual recalculations, and monitor job status.
              </p>
              <Badge variant="default" className="mt-4">Active</Badge>
            </CardContent>
          </Card>
        </Link>

        {/* Data Ingestion */}
        <Link href="/admin/ingestion" className="block">
          <Card className="hover:border-primary transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Data Ingestion
              </CardTitle>
              <CardDescription>
                Manage connectors and import data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Run ingestion jobs, upload review data, and monitor connector status across all tenants.
              </p>
              <Badge variant="default" className="mt-4">Active</Badge>
            </CardContent>
          </Card>
        </Link>

        {/* Audit Explorer */}
        <Link href="/admin/audit" className="block">
          <Card className="hover:border-primary transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Score Explorer
              </CardTitle>
              <CardDescription>
                Inspect score breakdowns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Deep dive into review scores with full weight breakdowns and reason codes.
              </p>
              <Badge variant="default" className="mt-4">Active</Badge>
            </CardContent>
          </Card>
        </Link>

        {/* Audit Logs */}
        <Link href="/admin/audit-logs" className="block">
          <Card className="hover:border-primary transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ClipboardList className="h-5 w-5" />
                Audit Logs
              </CardTitle>
              <CardDescription>
                System activity history
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Track all admin actions: parameter changes, score runs, connector edits, and more.
              </p>
              <Badge variant="default" className="mt-4">Active</Badge>
            </CardContent>
          </Card>
        </Link>

        {/* Till Slip Moderation */}
        <Link href="/admin/till-reviews/moderation" className="block">
          <Card className="hover:border-primary transition-colors cursor-pointer h-full">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquareWarning className="h-5 w-5" />
                Feedback Moderation
              </CardTitle>
              <CardDescription>
                Review flagged submissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Moderate flagged till slip feedback submissions. Approve or reject spam/suspicious content.
              </p>
              <Badge variant="default" className="mt-4">Active</Badge>
            </CardContent>
          </Card>
        </Link>

        {/* Tenant Management */}
        <Card className="opacity-75">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Tenants
            </CardTitle>
            <CardDescription>
              Manage organizations and branches
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              View and manage all tenants, organizations, and their subscription status.
            </p>
            <Badge variant="outline" className="mt-4">Coming Soon</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="mt-8 p-4 bg-muted rounded-lg">
        <p className="text-sm text-muted-foreground">
          <strong>Current User:</strong> {session.user.firstName} {session.user.lastName} ({session.user.email})
        </p>
        <p className="text-sm text-muted-foreground">
          <strong>Role:</strong> {session.user.role}
        </p>
      </div>
    </div>
  );
}
