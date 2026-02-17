"use client";

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  QrCode,
  CheckCircle2,
  XCircle,
  Clock,
  Star,
  AlertTriangle,
  Gift,
  Loader2,
  RefreshCw,
  Calendar,
  Receipt,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================
// TYPES
// ============================================================

interface CodeLookupResult {
  valid: boolean;
  error?: string;
  message?: string;
  redeemedAt?: string;
  expiredAt?: string;
  submission?: {
    id: string;
    redemptionCode: string;
    incentiveCode: string;
    createdAt: string;
    expiresAt?: string;
    overallRating: number;
    tenantName: string;
    receiptRef?: string;
    receiptDate?: string;
  };
}

interface RedemptionResult {
  success: boolean;
  error?: string;
  message: string;
  redemption?: {
    code: string;
    redeemedAt: string;
    redeemedBy: string;
    tenantName: string;
    receiptRef?: string;
  };
}

type PageState = "input" | "loading" | "preview" | "redeeming" | "success" | "error";

// ============================================================
// COMPONENT
// ============================================================

export default function RedeemPage() {
  const [pageState, setPageState] = useState<PageState>("input");
  const [code, setCode] = useState("");
  const [lookupResult, setLookupResult] = useState<CodeLookupResult | null>(null);
  const [redemptionResult, setRedemptionResult] = useState<RedemptionResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Handle code input - auto-uppercase and limit length
  const handleCodeInput = (value: string) => {
    // Remove any non-alphanumeric characters and uppercase
    const cleaned = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase().slice(0, 6);
    setCode(cleaned);
    
    // Auto-lookup when code is complete
    if (cleaned.length === 6) {
      lookupCode(cleaned);
    }
  };

  // Look up code without redeeming
  const lookupCode = async (codeToLookup: string) => {
    setPageState("loading");
    setLookupResult(null);
    
    try {
      const res = await fetch(`/api/portal/redeem?code=${codeToLookup}`);
      const data: CodeLookupResult = await res.json();
      
      setLookupResult(data);
      
      if (data.valid) {
        setPageState("preview");
      } else {
        setPageState("error");
      }
    } catch {
      setPageState("error");
      setLookupResult({
        valid: false,
        error: "NETWORK_ERROR",
        message: "Could not connect to server. Please try again.",
      });
    }
  };

  // Redeem the code
  const redeemCode = async () => {
    if (!lookupResult?.valid) return;
    
    setPageState("redeeming");
    
    try {
      const res = await fetch("/api/portal/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      
      const data: RedemptionResult = await res.json();
      setRedemptionResult(data);
      
      if (data.success) {
        setPageState("success");
        toast.success("Code redeemed successfully!");
      } else {
        setPageState("error");
        toast.error(data.message || "Failed to redeem code");
      }
    } catch {
      setPageState("error");
      setRedemptionResult({
        success: false,
        message: "Could not connect to server. Please try again.",
      });
    }
  };

  // Reset to start fresh
  const reset = () => {
    setCode("");
    setPageState("input");
    setLookupResult(null);
    setRedemptionResult(null);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  // Render rating stars
  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating ? "fill-amber-400 text-amber-400" : "text-gray-300"
            }`}
          />
        ))}
      </div>
    );
  };

  // Get error icon and color
  const getErrorStyle = (error?: string) => {
    switch (error) {
      case "ALREADY_REDEEMED":
        return { icon: CheckCircle2, color: "text-amber-600", bg: "bg-amber-50" };
      case "CODE_EXPIRED":
        return { icon: Clock, color: "text-gray-600", bg: "bg-gray-50" };
      default:
        return { icon: XCircle, color: "text-red-600", bg: "bg-red-50" };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1>Redeem Code</h1>
        <p className="text-muted-foreground">
          Verify and redeem customer discount codes from feedback submissions.
        </p>
      </div>

      {/* Main Card */}
      <Card className="max-w-md mx-auto">
        <CardHeader className="text-center pb-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            <QrCode className="h-8 w-8 text-primary" />
          </div>
          <CardTitle>Enter Redemption Code</CardTitle>
          <CardDescription>
            Enter the 6-character code shown on the customer&apos;s phone
          </CardDescription>
        </CardHeader>

        <CardContent>
          <AnimatePresence mode="wait">
            {/* Input State */}
            {pageState === "input" && (
              <motion.div
                key="input"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label htmlFor="code">Redemption Code</Label>
                  <Input
                    ref={inputRef}
                    id="code"
                    value={code}
                    onChange={(e) => handleCodeInput(e.target.value)}
                    placeholder="XXXXXX"
                    className="text-center text-2xl tracking-[0.3em] font-mono uppercase h-14"
                    maxLength={6}
                    autoComplete="off"
                    autoCapitalize="characters"
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    {code.length}/6 characters
                  </p>
                </div>
                
                <Button
                  className="w-full"
                  size="lg"
                  disabled={code.length !== 6}
                  onClick={() => lookupCode(code)}
                >
                  Verify Code
                </Button>
              </motion.div>
            )}

            {/* Loading State */}
            {pageState === "loading" && (
              <motion.div
                key="loading"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-8 text-center"
              >
                <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Verifying code...</p>
              </motion.div>
            )}

            {/* Preview State - Show details before redeeming */}
            {pageState === "preview" && lookupResult?.valid && lookupResult.submission && (
              <motion.div
                key="preview"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Code Badge */}
                <div className="text-center py-2">
                  <Badge variant="outline" className="text-lg px-4 py-2 font-mono tracking-wider">
                    {lookupResult.submission.redemptionCode}
                  </Badge>
                </div>

                {/* Submission Details */}
                <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Restaurant</span>
                    <span className="font-medium">{lookupResult.submission.tenantName}</span>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Customer Rating</span>
                    {renderStars(lookupResult.submission.overallRating)}
                  </div>
                  
                  {lookupResult.submission.receiptRef && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Receipt className="h-3 w-3" />
                        Receipt
                      </span>
                      <span className="font-mono text-sm">
                        ****{lookupResult.submission.receiptRef}
                      </span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      Submitted
                    </span>
                    <span className="text-sm">
                      {new Date(lookupResult.submission.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  
                  {lookupResult.submission.expiresAt && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Expires
                      </span>
                      <span className="text-sm">
                        {new Date(lookupResult.submission.expiresAt).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={reset}>
                    Cancel
                  </Button>
                  <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={redeemCode}>
                    <Gift className="h-4 w-4 mr-2" />
                    Confirm Redemption
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Redeeming State */}
            {pageState === "redeeming" && (
              <motion.div
                key="redeeming"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="py-8 text-center"
              >
                <Loader2 className="h-10 w-10 animate-spin text-green-600 mx-auto mb-4" />
                <p className="text-muted-foreground">Redeeming code...</p>
              </motion.div>
            )}

            {/* Success State */}
            {pageState === "success" && redemptionResult?.success && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="py-6 text-center space-y-4"
              >
                <div className="mx-auto w-20 h-20 rounded-full bg-green-100 flex items-center justify-center">
                  <CheckCircle2 className="h-12 w-12 text-green-600" />
                </div>
                
                <div>
                  <h3 className="text-xl font-semibold text-green-700">
                    Code Redeemed!
                  </h3>
                  <p className="text-muted-foreground mt-1">
                    Apply the discount to the customer&apos;s order.
                  </p>
                </div>

                {redemptionResult.redemption && (
                  <div className="bg-green-50 rounded-lg p-4 text-left space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-700">Code</span>
                      <span className="font-mono font-bold">{redemptionResult.redemption.code}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-700">Redeemed by</span>
                      <span>{redemptionResult.redemption.redeemedBy}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-green-700">Time</span>
                      <span>{new Date(redemptionResult.redemption.redeemedAt).toLocaleTimeString()}</span>
                    </div>
                  </div>
                )}

                <Button onClick={reset} className="w-full" size="lg">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Verify Another Code
                </Button>
              </motion.div>
            )}

            {/* Error State */}
            {pageState === "error" && (
              <motion.div
                key="error"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="py-6 text-center space-y-4"
              >
                {(() => {
                  const errorStyle = getErrorStyle(lookupResult?.error || redemptionResult?.error);
                  const ErrorIcon = errorStyle.icon;
                  return (
                    <div className={`mx-auto w-20 h-20 rounded-full ${errorStyle.bg} flex items-center justify-center`}>
                      <ErrorIcon className={`h-12 w-12 ${errorStyle.color}`} />
                    </div>
                  );
                })()}
                
                <div>
                  <h3 className="text-xl font-semibold">
                    {lookupResult?.error === "ALREADY_REDEEMED" 
                      ? "Already Redeemed"
                      : lookupResult?.error === "CODE_EXPIRED"
                      ? "Code Expired"
                      : "Invalid Code"}
                  </h3>
                  <p className="text-muted-foreground mt-1">
                    {lookupResult?.message || redemptionResult?.message || "Could not verify this code."}
                  </p>
                </div>

                {lookupResult?.redeemedAt && (
                  <div className="bg-amber-50 rounded-lg p-3 text-sm text-amber-800">
                    <AlertTriangle className="h-4 w-4 inline mr-2" />
                    Redeemed on {new Date(lookupResult.redeemedAt).toLocaleString()}
                  </div>
                )}

                {lookupResult?.expiredAt && (
                  <div className="bg-gray-100 rounded-lg p-3 text-sm text-gray-600">
                    <Clock className="h-4 w-4 inline mr-2" />
                    Expired on {new Date(lookupResult.expiredAt).toLocaleDateString()}
                  </div>
                )}

                <Button onClick={reset} className="w-full" size="lg">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Try Another Code
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Help Text */}
      <Card className="max-w-md mx-auto">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
            </div>
            <div className="text-sm">
              <p className="font-medium mb-1">How it works</p>
              <ol className="text-muted-foreground space-y-1 list-decimal list-inside">
                <li>Customer shows 6-character code on their phone</li>
                <li>Enter the code above to verify</li>
                <li>Confirm redemption to apply discount</li>
                <li>Code can only be used once</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
