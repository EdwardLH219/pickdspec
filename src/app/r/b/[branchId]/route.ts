/**
 * Route: Short URL Redirect for Option B
 * 
 * Redirects /r/b/{branchId}?ref=...&t=...&s=... to the mint-on-visit endpoint
 * 
 * This provides a shorter URL format for receipt QR codes:
 * https://app.pickd.co/r/b/{branchId}?ref=INV-001&t=1706355000&s=abc123
 * 
 * Instead of the full API path:
 * https://app.pickd.co/api/branches/{branchId}/till/mint-on-visit?ref=...
 */

import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ branchId: string }> }
): Promise<NextResponse> {
  const { branchId } = await params;
  const { searchParams } = new URL(request.url);
  
  // Build redirect URL to the actual endpoint
  const apiUrl = new URL(
    `/api/branches/${branchId}/till/mint-on-visit`,
    request.url
  );
  
  // Forward all query params
  searchParams.forEach((value, key) => {
    apiUrl.searchParams.set(key, value);
  });
  
  return NextResponse.redirect(apiUrl);
}
