"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "sonner";
import {
  QrCode,
  Download,
  Gift,
  Percent,
  Trophy,
  MessageSquare,
  Shield,
  Clock,
  ChevronLeft,
  Loader2,
  Settings,
  Eye,
  Copy,
  ExternalLink,
  Star,
  Sparkles,
  AlertCircle,
  Check,
  Printer,
  Save,
} from "lucide-react";

// ============================================================
// TYPES
// ============================================================

type IncentiveType = "NONE" | "DISCOUNT" | "PRIZE_DRAW" | "CUSTOM";

interface TillSettings {
  id: string;
  isActive: boolean;
  shortCode: string;
  incentiveType: IncentiveType;
  incentiveTitle: string | null;
  incentiveDescription: string | null;
  discountPercent: number | null;
  discountTerms: string | null;
  prizeDrawTitle: string | null;
  prizeDrawDescription: string | null;
  prizeDrawTerms: string | null;
  headerColor: string | null;
  accentColor: string | null;
  tokenExpiryDays: number;
  requireReceiptNumber: boolean;
  redirectToGoogleReview: boolean;
  googleReviewUrl: string | null;
}

interface TenantInfo {
  id: string;
  name: string;
  slug: string;
}

// ============================================================
// COMPONENT
// ============================================================

export default function TillReviewsPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const resolvedParams = use(params);
  const branchId = resolvedParams.branchId;
  const router = useRouter();

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [expiryPresets, setExpiryPresets] = useState<number[]>([7, 14, 30, 60, 90]);
  const [suggestedGoogleUrl, setSuggestedGoogleUrl] = useState<string | null>(null);
  const [qrPreviewUrl, setQrPreviewUrl] = useState<string | null>(null);

  // Form state
  const [isActive, setIsActive] = useState(false);
  const [shortCode, setShortCode] = useState("");
  const [incentiveType, setIncentiveType] = useState<IncentiveType>("NONE");
  const [incentiveTitle, setIncentiveTitle] = useState("");
  const [incentiveDescription, setIncentiveDescription] = useState("");
  const [discountPercent, setDiscountPercent] = useState<number>(10);
  const [discountTerms, setDiscountTerms] = useState("");
  const [prizeDrawTitle, setPrizeDrawTitle] = useState("");
  const [prizeDrawDescription, setPrizeDrawDescription] = useState("");
  const [prizeDrawTerms, setPrizeDrawTerms] = useState("");
  const [headerColor, setHeaderColor] = useState("#1e40af");
  const [accentColor, setAccentColor] = useState("#3b82f6");
  const [tokenExpiryDays, setTokenExpiryDays] = useState(7);
  const [requireReceiptNumber, setRequireReceiptNumber] = useState(false);
  const [redirectToGoogleReview, setRedirectToGoogleReview] = useState(true);
  const [googleReviewUrl, setGoogleReviewUrl] = useState("");

  // ============================================================
  // DATA FETCHING
  // ============================================================

  useEffect(() => {
    async function fetchSettings() {
      try {
        const res = await fetch(`/api/portal/branches/${branchId}/till-settings`);
        
        if (!res.ok) {
          const errorData = await res.json().catch(() => ({}));
          const errorMessage = errorData.error || 'Failed to fetch settings';
          
          if (res.status === 401) {
            toast.error("Please log in to access this page");
          } else if (res.status === 403) {
            toast.error("You don't have access to this branch");
          } else if (res.status === 404) {
            toast.error("Branch not found");
          } else {
            toast.error(errorMessage);
          }
          return;
        }
        
        const data = await res.json();
        setTenant(data.tenant);
        setCanEdit(data.canEdit);
        setExpiryPresets(data.expiryPresets || [7, 14, 30, 60, 90]);
        setSuggestedGoogleUrl(data.suggestedGoogleReviewUrl);

        if (data.settings) {
          const s = data.settings;
          setIsActive(s.isActive);
          setShortCode(s.shortCode);
          setIncentiveType(s.incentiveType);
          setIncentiveTitle(s.incentiveTitle || "");
          setIncentiveDescription(s.incentiveDescription || "");
          setDiscountPercent(s.discountPercent || 10);
          setDiscountTerms(s.discountTerms || "");
          setPrizeDrawTitle(s.prizeDrawTitle || "");
          setPrizeDrawDescription(s.prizeDrawDescription || "");
          setPrizeDrawTerms(s.prizeDrawTerms || "");
          setHeaderColor(s.headerColor || "#1e40af");
          setAccentColor(s.accentColor || "#3b82f6");
          setTokenExpiryDays(s.tokenExpiryDays);
          setRequireReceiptNumber(s.requireReceiptNumber);
          setRedirectToGoogleReview(s.redirectToGoogleReview);
          setGoogleReviewUrl(s.googleReviewUrl || "");
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
        toast.error("Failed to load settings. Please try again.");
      } finally {
        setLoading(false);
      }
    }

    fetchSettings();
  }, [branchId]);

  // Generate QR preview when settings are active
  useEffect(() => {
    if (shortCode && isActive) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.pickd.co";
      setQrPreviewUrl(`${baseUrl}/r/${shortCode}`);
    }
  }, [shortCode, isActive]);

  // ============================================================
  // HANDLERS
  // ============================================================

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch(`/api/portal/branches/${branchId}/till-settings`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          isActive,
          incentiveType,
          incentiveTitle: incentiveTitle || null,
          incentiveDescription: incentiveDescription || null,
          discountPercent: incentiveType === "DISCOUNT" ? discountPercent : null,
          discountTerms: incentiveType === "DISCOUNT" ? discountTerms || null : null,
          prizeDrawTitle: incentiveType === "PRIZE_DRAW" ? prizeDrawTitle || null : null,
          prizeDrawDescription: incentiveType === "PRIZE_DRAW" ? prizeDrawDescription || null : null,
          prizeDrawTerms: incentiveType === "PRIZE_DRAW" ? prizeDrawTerms || null : null,
          headerColor,
          accentColor,
          tokenExpiryDays,
          requireReceiptNumber,
          redirectToGoogleReview,
          googleReviewUrl: googleReviewUrl || null,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save");
      }

      const data = await res.json();
      if (data.settings?.shortCode) {
        setShortCode(data.settings.shortCode);
      }

      toast.success("Settings saved successfully");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadQR(format: "png" | "svg") {
    try {
      const res = await fetch(
        `/api/portal/branches/${branchId}/till-qr?format=${format}&size=500&download=true`
      );
      if (!res.ok) throw new Error("Failed to generate QR code");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${tenant?.slug || branchId}-feedback-qr.${format}`;
      a.click();
      URL.revokeObjectURL(url);

      toast.success(`QR code downloaded as ${format.toUpperCase()}`);
    } catch (error) {
      console.error("Error downloading QR:", error);
      toast.error("Failed to download QR code");
    }
  }

  function copyFeedbackUrl() {
    if (qrPreviewUrl) {
      navigator.clipboard.writeText(qrPreviewUrl);
      toast.success("URL copied to clipboard");
    }
  }

  function useGoogleSuggestion() {
    if (suggestedGoogleUrl) {
      setGoogleReviewUrl(suggestedGoogleUrl);
    }
  }

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  function getIncentiveIcon(type: IncentiveType) {
    switch (type) {
      case "DISCOUNT":
        return <Percent className="h-4 w-4" />;
      case "PRIZE_DRAW":
        return <Trophy className="h-4 w-4" />;
      case "CUSTOM":
        return <Gift className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  }

  function getPreviewIncentiveContent() {
    switch (incentiveType) {
      case "DISCOUNT":
        return {
          title: incentiveTitle || `Get ${discountPercent}% OFF`,
          description: incentiveDescription || "Your next visit as a thank you",
        };
      case "PRIZE_DRAW":
        return {
          title: prizeDrawTitle || "Win a Free Meal!",
          description: prizeDrawDescription || "Every review is an entry",
        };
      case "CUSTOM":
        return {
          title: incentiveTitle || "Thank You!",
          description: incentiveDescription || "We appreciate your feedback",
        };
      default:
        return {
          title: "Share Your Experience",
          description: "Your feedback helps us improve",
        };
    }
  }

  // ============================================================
  // LOADING STATE
  // ============================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // ============================================================
  // MAIN RENDER
  // ============================================================

  const previewContent = getPreviewIncentiveContent();

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push("/account")}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Till Slip Feedback</h1>
            {isActive ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                Active
              </Badge>
            ) : (
              <Badge variant="secondary">Disabled</Badge>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            Collect customer feedback via QR codes on receipts for{" "}
            <span className="font-medium">{tenant?.name}</span>
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleSave} disabled={saving}>
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Changes
          </Button>
        )}
      </div>

      {!canEdit && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600" />
          <p className="text-sm text-amber-800 dark:text-amber-200">
            You have view-only access. Contact an owner to modify these settings.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Settings */}
        <div className="lg:col-span-2 space-y-6">
          {/* Enable Toggle */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <QrCode className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">Receipt Feedback</CardTitle>
                    <CardDescription>
                      Enable QR code feedback collection on receipts
                    </CardDescription>
                  </div>
                </div>
                <Switch
                  checked={isActive}
                  onCheckedChange={setIsActive}
                  disabled={!canEdit}
                />
              </div>
            </CardHeader>
          </Card>

          {/* Incentive Configuration */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-100 dark:bg-amber-900/30 rounded-lg">
                  <Gift className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Incentive</CardTitle>
                  <CardDescription>
                    Reward customers for leaving feedback
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Incentive Type */}
              <div className="space-y-2">
                <Label>Incentive Type</Label>
                <Select
                  value={incentiveType}
                  onValueChange={(v) => setIncentiveType(v as IncentiveType)}
                  disabled={!canEdit}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NONE">
                      <div className="flex items-center gap-2">
                        <MessageSquare className="h-4 w-4" />
                        No Incentive (Thank You Only)
                      </div>
                    </SelectItem>
                    <SelectItem value="DISCOUNT">
                      <div className="flex items-center gap-2">
                        <Percent className="h-4 w-4" />
                        Discount Code
                      </div>
                    </SelectItem>
                    <SelectItem value="PRIZE_DRAW">
                      <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4" />
                        Prize Draw Entry
                      </div>
                    </SelectItem>
                    <SelectItem value="CUSTOM">
                      <div className="flex items-center gap-2">
                        <Gift className="h-4 w-4" />
                        Custom Message
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Discount Settings */}
              {incentiveType === "DISCOUNT" && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Discount Percentage</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          value={discountPercent}
                          onChange={(e) => setDiscountPercent(parseInt(e.target.value) || 10)}
                          disabled={!canEdit}
                          className="w-24"
                        />
                        <span className="text-muted-foreground">%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Display Title</Label>
                      <Input
                        placeholder={`Get ${discountPercent}% OFF`}
                        value={incentiveTitle}
                        onChange={(e) => setIncentiveTitle(e.target.value)}
                        disabled={!canEdit}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input
                      placeholder="Your next visit as a thank you"
                      value={incentiveDescription}
                      onChange={(e) => setIncentiveDescription(e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Terms & Conditions</Label>
                    <Textarea
                      placeholder="Valid for 30 days. One use per customer. Cannot be combined with other offers."
                      value={discountTerms}
                      onChange={(e) => setDiscountTerms(e.target.value)}
                      disabled={!canEdit}
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {/* Prize Draw Settings */}
              {incentiveType === "PRIZE_DRAW" && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Prize Title</Label>
                      <Input
                        placeholder="Win a Free Dinner for 4!"
                        value={prizeDrawTitle}
                        onChange={(e) => setPrizeDrawTitle(e.target.value)}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Prize Description</Label>
                      <Input
                        placeholder="Every review is an entry"
                        value={prizeDrawDescription}
                        onChange={(e) => setPrizeDrawDescription(e.target.value)}
                        disabled={!canEdit}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Terms & Conditions</Label>
                    <Textarea
                      placeholder="Draw held last Friday of each month. Winner contacted via email. Must be 18+."
                      value={prizeDrawTerms}
                      onChange={(e) => setPrizeDrawTerms(e.target.value)}
                      disabled={!canEdit}
                      rows={2}
                    />
                  </div>
                </div>
              )}

              {/* Custom Message Settings */}
              {incentiveType === "CUSTOM" && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input
                      placeholder="Thank You!"
                      value={incentiveTitle}
                      onChange={(e) => setIncentiveTitle(e.target.value)}
                      disabled={!canEdit}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea
                      placeholder="We appreciate your feedback. It helps us serve you better."
                      value={incentiveDescription}
                      onChange={(e) => setIncentiveDescription(e.target.value)}
                      disabled={!canEdit}
                      rows={2}
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* QR Code Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                  <QrCode className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">QR Code</CardTitle>
                  <CardDescription>
                    Download and print on your receipts
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {!isActive ? (
                <div className="text-center py-8 text-muted-foreground">
                  <QrCode className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p>Enable receipt feedback to generate QR code</p>
                </div>
              ) : !shortCode ? (
                <div className="text-center py-8 text-muted-foreground">
                  <QrCode className="h-12 w-12 mx-auto mb-3 opacity-30" />
                  <p className="mb-2">Save settings to generate your QR code</p>
                  <p className="text-sm text-muted-foreground/70">
                    Click &quot;Save Changes&quot; to create your feedback URL
                  </p>
                </div>
              ) : (
                <>
                  {/* QR Preview */}
                  <div className="flex flex-col items-center gap-4 p-6 bg-muted/30 rounded-lg">
                    <div className="bg-white p-4 rounded-lg shadow-sm">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`/api/portal/branches/${branchId}/till-qr?format=png&size=200&t=${shortCode}`}
                        alt="Feedback QR Code"
                        className="w-48 h-48"
                        onError={(e) => {
                          // Hide broken image
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadQR("png")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        PNG
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadQR("svg")}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        SVG
                      </Button>
                    </div>
                  </div>

                  {/* Feedback URL */}
                  <div className="space-y-2">
                    <Label>Feedback URL</Label>
                    <p className="text-xs text-muted-foreground">
                      This is the URL customers visit when they scan the QR code
                    </p>
                    <div className="flex gap-2">
                      <Input
                        value={qrPreviewUrl || ""}
                        readOnly
                        className="font-mono text-sm"
                        placeholder="Save settings to generate URL"
                      />
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" onClick={copyFeedbackUrl}>
                              <Copy className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Copy URL</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => window.open(qrPreviewUrl || "", "_blank")}
                            >
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Open Preview</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>

                  {/* Receipt Template */}
                  <div className="space-y-3">
                    <Label className="flex items-center gap-2">
                      <Printer className="h-4 w-4" />
                      Receipt Template Snippet
                    </Label>
                    <div className="bg-muted p-4 rounded-lg font-mono text-xs leading-relaxed">
                      <div className="text-center border-b border-dashed pb-4 mb-4">
                        <p className="font-bold text-sm mb-1">How was your experience?</p>
                        <p className="text-muted-foreground">Scan to share feedback</p>
                        <div className="my-3 inline-block bg-white p-2 rounded">
                          <div className="w-16 h-16 border-2 border-dashed border-gray-300 flex items-center justify-center text-[8px] text-gray-400">
                            QR CODE
                          </div>
                        </div>
                        {incentiveType !== "NONE" && (
                          <p className="text-[10px] font-medium text-primary">
                            {previewContent.title}
                          </p>
                        )}
                      </div>
                      <p className="text-center text-muted-foreground text-[10px]">
                        Or visit: {qrPreviewUrl?.replace("https://", "")}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Add this section to your POS receipt template. Replace the placeholder with the downloaded QR code.
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Security Settings */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                  <Shield className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <CardTitle className="text-lg">Security & Options</CardTitle>
                  <CardDescription>
                    Configure token expiry and validation
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Token Expiry */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Token Expiry
                </Label>
                <Select
                  value={String(tokenExpiryDays)}
                  onValueChange={(v) => setTokenExpiryDays(parseInt(v))}
                  disabled={!canEdit}
                >
                  <SelectTrigger className="w-48">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {expiryPresets.map((days) => (
                      <SelectItem key={days} value={String(days)}>
                        {days} days
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Feedback links expire after this period for security
                </p>
              </div>

              <Separator />

              {/* Receipt Number */}
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Require Receipt Number</Label>
                  <p className="text-xs text-muted-foreground">
                    Ask customers to enter their receipt number for verification
                  </p>
                </div>
                <Switch
                  checked={requireReceiptNumber}
                  onCheckedChange={setRequireReceiptNumber}
                  disabled={!canEdit}
                />
              </div>

              <Separator />

              {/* Google Review Redirect */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label>Prompt for Google Review</Label>
                    <p className="text-xs text-muted-foreground">
                      After feedback, offer to leave a public Google review
                    </p>
                  </div>
                  <Switch
                    checked={redirectToGoogleReview}
                    onCheckedChange={setRedirectToGoogleReview}
                    disabled={!canEdit}
                  />
                </div>

                {redirectToGoogleReview && (
                  <div className="space-y-2">
                    <Label>Google Review URL</Label>
                    <div className="flex gap-2">
                      <Input
                        placeholder="https://g.page/r/..."
                        value={googleReviewUrl}
                        onChange={(e) => setGoogleReviewUrl(e.target.value)}
                        disabled={!canEdit}
                      />
                      {suggestedGoogleUrl && !googleReviewUrl && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={useGoogleSuggestion}
                          disabled={!canEdit}
                        >
                          Use Suggested
                        </Button>
                      )}
                    </div>
                    {suggestedGoogleUrl && (
                      <p className="text-xs text-muted-foreground">
                        Based on your Google Place ID, we suggest:{" "}
                        <code className="text-[10px]">{suggestedGoogleUrl.substring(0, 50)}...</code>
                      </p>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Column - Preview */}
        <div className="space-y-6">
          {/* Live Preview Card */}
          <Card className="sticky top-6">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-sm font-medium">Customer Preview</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {/* Phone Frame */}
              <div className="mx-auto w-[280px] bg-gray-900 rounded-[2.5rem] p-3 shadow-xl">
                <div className="bg-white rounded-[2rem] overflow-hidden">
                  {/* Header */}
                  <div
                    className="px-4 py-6 text-white text-center"
                    style={{ backgroundColor: headerColor }}
                  >
                    <div className="flex justify-center mb-3">
                      <div className="p-3 bg-white/20 rounded-full">
                        <Sparkles className="h-6 w-6" />
                      </div>
                    </div>
                    <h3 className="font-semibold text-lg mb-1">
                      {tenant?.name || "Restaurant Name"}
                    </h3>
                    <p className="text-sm opacity-90">We value your feedback</p>
                  </div>

                  {/* Incentive Card */}
                  {incentiveType !== "NONE" && (
                    <div className="px-4 -mt-4 relative z-10">
                      <div
                        className="rounded-xl p-4 text-white shadow-lg"
                        style={{ backgroundColor: accentColor }}
                      >
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-white/20 rounded-lg">
                            {getIncentiveIcon(incentiveType)}
                          </div>
                          <div>
                            <p className="font-semibold">{previewContent.title}</p>
                            <p className="text-sm opacity-90">{previewContent.description}</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Rating Section */}
                  <div className="p-4 space-y-4">
                    <div className="text-center">
                      <p className="text-sm font-medium text-gray-700 mb-3">
                        How was your experience?
                      </p>
                      <div className="flex justify-center gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <div
                            key={star}
                            className="p-2 rounded-full hover:bg-amber-50 cursor-pointer transition-colors"
                          >
                            <Star
                              className={`h-8 w-8 ${
                                star <= 4
                                  ? "fill-amber-400 text-amber-400"
                                  : "text-gray-300"
                              }`}
                            />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Theme Chips Preview */}
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                        What was great?
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {["Food", "Service", "Ambiance"].map((theme) => (
                          <Badge
                            key={theme}
                            variant="outline"
                            className="cursor-pointer hover:bg-green-50 hover:border-green-500 hover:text-green-700 transition-colors"
                          >
                            <Check className="h-3 w-3 mr-1" />
                            {theme}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    {/* Submit Button */}
                    <Button
                      className="w-full"
                      style={{ backgroundColor: accentColor }}
                    >
                      Submit Feedback
                    </Button>
                  </div>
                </div>
              </div>

              {/* Color Customization */}
              <div className="p-4 space-y-4">
                <Separator />
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs">Header Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={headerColor}
                        onChange={(e) => setHeaderColor(e.target.value)}
                        disabled={!canEdit}
                        className="w-8 h-8 rounded cursor-pointer border-0"
                      />
                      <Input
                        value={headerColor}
                        onChange={(e) => setHeaderColor(e.target.value)}
                        disabled={!canEdit}
                        className="font-mono text-xs h-8"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs">Accent Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        disabled={!canEdit}
                        className="w-8 h-8 rounded cursor-pointer border-0"
                      />
                      <Input
                        value={accentColor}
                        onChange={(e) => setAccentColor(e.target.value)}
                        disabled={!canEdit}
                        className="font-mono text-xs h-8"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
