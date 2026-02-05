/**
 * Admin Console Page
 * 
 * Pick'd Admin only - for managing scoring parameters, tenants, and system settings.
 */

import { auth } from '@/lib/auth/config';
import { redirect } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Settings, Users, Database, Activity } from 'lucide-react';

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
        <Card>
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
            <Badge variant="outline" className="mt-4">Coming Soon</Badge>
          </CardContent>
        </Card>

        {/* Tenant Management */}
        <Card>
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

        {/* Score Runs */}
        <Card>
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
            <Badge variant="outline" className="mt-4">Coming Soon</Badge>
          </CardContent>
        </Card>

        {/* Audit Logs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              Audit Logs
            </CardTitle>
            <CardDescription>
              System activity history
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              View audit trail of all system actions including parameter changes and score runs.
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
