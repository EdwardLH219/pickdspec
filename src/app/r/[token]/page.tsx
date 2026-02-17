"use client";

import { useEffect, useState, use, useCallback, memo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star,
  Sparkles,
  Gift,
  Percent,
  Trophy,
  MessageSquare,
  Check,
  ChevronRight,
  ExternalLink,
  Copy,
  AlertCircle,
  Clock,
  CheckCircle2,
  Plus,
  Heart,
  ThumbsDown,
  Loader2,
  Shield,
  Ban,
  RefreshCw,
  CheckCheck,
} from "lucide-react";
import Script from "next/script";

// ============================================================
// TYPES
// ============================================================

type IncentiveType = "NONE" | "DISCOUNT" | "PRIZE_DRAW" | "CUSTOM";

interface Settings {
  incentiveType: IncentiveType;
  incentiveTitle: string | null;
  incentiveDescription: string | null;
  discountPercent: number | null;
  discountTerms: string | null;
  prizeDrawTitle: string | null;
  prizeDrawDescription: string | null;
  prizeDrawTerms: string | null;
  headerColor: string;
  accentColor: string;
  requireReceiptNumber: boolean;
  redirectToGoogleReview: boolean;
  googleReviewUrl: string | null;
  themeOptions: string[];
  captchaEnabled: boolean;
  captchaProvider: "hcaptcha" | "turnstile" | null;
  captchaSiteKey: string | null;
}

interface TokenValidation {
  valid: boolean;
  error?: string;
  errorMessage?: string;
  tenantName?: string;
  settings?: Settings;
  receipt?: {
    id: string;
    receiptLastFour: string | null;
  };
}

interface SubmissionResult {
  success: boolean;
  error?: string;
  errorMessage?: string;
  incentiveType?: IncentiveType;
  incentiveCode?: string;
  incentiveCodeExpiry?: string;
  redemptionCode?: string;
  discountPercent?: number;
  discountTerms?: string;
  prizeDrawTerms?: string;
  redirectToGoogleReview?: boolean;
  googleReviewUrl?: string;
}

type PageState = "loading" | "form" | "submitting" | "success" | "error";

// ============================================================
// ANIMATION VARIANTS (optimized for performance)
// ============================================================

const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
};

const slideUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
};

const springScale = {
  initial: { scale: 0.8, opacity: 0 },
  animate: { 
    scale: 1, 
    opacity: 1,
  },
};

const staggerContainer = {
  animate: {
    transition: { staggerChildren: 0.05 }
  }
};

// ============================================================
// SKELETON COMPONENTS
// ============================================================

const Skeleton = memo(function Skeleton({ 
  className = "" 
}: { 
  className?: string 
}) {
  return (
    <div 
      className={`animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 bg-[length:200%_100%] rounded ${className}`}
      style={{ animation: "shimmer 1.5s infinite" }}
    />
  );
});

const LoadingSkeleton = memo(function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header Skeleton */}
      <div className="bg-gray-200 px-4 py-8">
        <div className="flex flex-col items-center">
          <Skeleton className="w-16 h-16 rounded-full mb-4" />
          <Skeleton className="h-6 w-40 mb-2" />
          <Skeleton className="h-4 w-48" />
        </div>
      </div>

      {/* Incentive Card Skeleton */}
      <div className="px-4 -mt-4 relative z-10">
        <Skeleton className="h-20 rounded-xl" />
      </div>

      {/* Form Content Skeleton */}
      <div className="px-4 py-6 space-y-6 max-w-lg mx-auto">
        {/* Rating Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <Skeleton className="h-5 w-36 mx-auto mb-6" />
          <div className="flex justify-center gap-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="w-12 h-12 rounded-full" />
            ))}
          </div>
        </div>

        {/* Theme Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <Skeleton className="h-5 w-32 mb-4" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-10 w-20 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
            <Skeleton className="h-10 w-16 rounded-full" />
            <Skeleton className="h-10 w-28 rounded-full" />
            <Skeleton className="h-10 w-20 rounded-full" />
            <Skeleton className="h-10 w-24 rounded-full" />
          </div>
        </div>
      </div>

      {/* Shimmer keyframes */}
      <style jsx global>{`
        @keyframes shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
});

// ============================================================
// ERROR STATE COMPONENT
// ============================================================

const ErrorState = memo(function ErrorState({
  errorType,
  errorMessage,
}: {
  errorType: string;
  errorMessage: string;
}) {
  const isAlreadyUsed = errorType === "TOKEN_ALREADY_USED";
  const isExpired = errorType === "TOKEN_EXPIRED";
  const isInactive = errorType === "CHANNEL_INACTIVE";

  const config = {
    TOKEN_ALREADY_USED: {
      icon: CheckCheck,
      iconBg: "bg-emerald-50",
      iconColor: "text-emerald-600",
      title: "Feedback Already Received",
      subtitle: "We've got your thoughts!",
      description: "You've already shared your experience with us for this visit. Thank you for taking the time!",
    },
    TOKEN_EXPIRED: {
      icon: Clock,
      iconBg: "bg-amber-50",
      iconColor: "text-amber-600",
      title: "Link Has Expired",
      subtitle: "This feedback window has closed",
      description: "For the best experience, please share your feedback within a few days of your visit. Ask your server for a new receipt to try again.",
    },
    CHANNEL_INACTIVE: {
      icon: Ban,
      iconBg: "bg-gray-100",
      iconColor: "text-gray-500",
      title: "Feedback Unavailable",
      subtitle: "This feature is currently disabled",
      description: "The restaurant has temporarily paused feedback collection. Please try again later or speak with a team member.",
    },
    TOKEN_NOT_FOUND: {
      icon: AlertCircle,
      iconBg: "bg-red-50",
      iconColor: "text-red-500",
      title: "Link Not Found",
      subtitle: "We couldn't find this feedback link",
      description: "This link may have been entered incorrectly. Please scan the QR code on your receipt again.",
    },
    default: {
      icon: AlertCircle,
      iconBg: "bg-red-50",
      iconColor: "text-red-500",
      title: "Something Went Wrong",
      subtitle: "We couldn't load the feedback form",
      description: errorMessage || "Please try again or scan the QR code one more time.",
    },
  };

  const { icon: Icon, iconBg, iconColor, title, subtitle, description } = 
    config[errorType as keyof typeof config] || config.default;

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-6">
      <motion.div 
        {...fadeIn}
        className="max-w-sm w-full text-center"
      >
        {/* Icon */}
        <motion.div 
          {...springScale}
          className={`w-20 h-20 ${iconBg} rounded-full mx-auto mb-6 flex items-center justify-center`}
        >
          <Icon className={`h-10 w-10 ${iconColor}`} strokeWidth={1.5} />
        </motion.div>

        {/* Title */}
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-2xl font-bold text-gray-900 mb-2"
        >
          {title}
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-gray-500 font-medium mb-4"
        >
          {subtitle}
        </motion.p>

        {/* Description */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-gray-600 text-sm leading-relaxed mb-8"
        >
          {description}
        </motion.p>

        {/* Additional message for already used */}
        {isAlreadyUsed && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-emerald-50 rounded-xl p-4 text-left"
          >
            <div className="flex items-start gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-900">Your feedback matters</p>
                <p className="text-sm text-emerald-700 mt-1">
                  We review every piece of feedback to continuously improve your experience.
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {/* Retry for expired */}
        {isExpired && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            onClick={() => window.location.reload()}
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </motion.button>
        )}

        {/* Footer */}
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-xs text-gray-400 mt-8"
        >
          {isAlreadyUsed 
            ? "You can close this page" 
            : isInactive 
              ? "Contact the restaurant for assistance"
              : "Need help? Ask your server"
          }
        </motion.p>
      </motion.div>
    </div>
  );
});

// ============================================================
// STAR RATING COMPONENT (Memoized for performance)
// ============================================================

const StarRating = memo(function StarRating({
  rating,
  hoverRating,
  onRate,
  onHover,
  onLeave,
}: {
  rating: number;
  hoverRating: number;
  onRate: (rating: number) => void;
  onHover: (rating: number) => void;
  onLeave: () => void;
}) {
  return (
    <div 
      className="flex justify-center gap-1 sm:gap-2"
      role="radiogroup"
      aria-label="Rating"
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const isActive = star <= (hoverRating || rating);
        const isSelected = star === rating;
        
        return (
          <motion.button
            key={star}
            type="button"
            onClick={() => onRate(star)}
            onMouseEnter={() => onHover(star)}
            onMouseLeave={onLeave}
            onFocus={() => onHover(star)}
            onBlur={onLeave}
            whileTap={{ scale: 0.9 }}
            className={`relative p-1.5 sm:p-2 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 ${
              isActive ? "bg-amber-50" : "bg-transparent hover:bg-gray-50"
            }`}
            role="radio"
            aria-checked={rating === star}
            aria-label={`${star} star${star !== 1 ? "s" : ""}`}
          >
            <motion.div
              animate={isSelected ? { scale: [1, 1.2, 1] } : { scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <Star
                className={`h-10 w-10 sm:h-12 sm:w-12 transition-all duration-150 ${
                  isActive
                    ? "fill-amber-400 text-amber-400 drop-shadow-sm"
                    : "text-gray-300"
                }`}
                strokeWidth={1.5}
              />
            </motion.div>
            
            {/* Pulse effect on selection */}
            {isSelected && (
              <motion.div
                initial={{ scale: 0.8, opacity: 1 }}
                animate={{ scale: 2, opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute inset-0 rounded-full bg-amber-400"
              />
            )}
          </motion.button>
        );
      })}
    </div>
  );
});

// ============================================================
// THEME CHIP COMPONENT (Memoized for performance)
// ============================================================

const ThemeChip = memo(function ThemeChip({
  theme,
  type,
  isSelected,
  isDisabled,
  onToggle,
  accentColor,
}: {
  theme: string;
  type: "positive" | "negative";
  isSelected: boolean;
  isDisabled: boolean;
  onToggle: () => void;
  accentColor: string;
}) {
  const colors = {
    positive: {
      selected: "bg-emerald-100 text-emerald-700 border-emerald-400 shadow-sm",
      hover: "hover:bg-emerald-50 hover:border-emerald-300",
      checkColor: "text-emerald-600",
    },
    negative: {
      selected: "bg-amber-100 text-amber-700 border-amber-400 shadow-sm",
      hover: "hover:bg-amber-50 hover:border-amber-300",
      checkColor: "text-amber-600",
    },
  };

  const config = colors[type];

  return (
    <motion.button
      type="button"
      onClick={onToggle}
      disabled={isDisabled}
      layout
      whileTap={!isDisabled ? { scale: 0.95 } : undefined}
      className={`
        relative px-4 py-2.5 rounded-full text-sm font-medium 
        border-2 transition-all duration-150
        focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2
        ${isSelected 
          ? config.selected
          : isDisabled
            ? "bg-gray-50 text-gray-400 border-transparent cursor-not-allowed opacity-50"
            : `bg-white text-gray-700 border-gray-200 ${config.hover}`
        }
      `}
      aria-pressed={isSelected}
      aria-label={`${theme} - ${type === "positive" ? "great" : "needs improvement"}`}
    >
      <span className="flex items-center gap-1.5">
        <AnimatePresence mode="wait">
          {isSelected && (
            <motion.span
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 25 }}
            >
              <Check className={`h-3.5 w-3.5 ${config.checkColor}`} strokeWidth={3} />
            </motion.span>
          )}
        </AnimatePresence>
        {theme}
      </span>
    </motion.button>
  );
});

// ============================================================
// MAIN COMPONENT
// ============================================================

export default function PublicFeedbackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const resolvedParams = use(params);
  const token = resolvedParams.token;

  // Page state
  const [pageState, setPageState] = useState<PageState>("loading");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [errorType, setErrorType] = useState<string>("");

  // Token data
  const [tenantName, setTenantName] = useState<string>("");
  const [settings, setSettings] = useState<Settings | null>(null);

  // Form state
  const [rating, setRating] = useState<number>(0);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [positiveThemes, setPositiveThemes] = useState<string[]>([]);
  const [negativeThemes, setNegativeThemes] = useState<string[]>([]);
  const [positiveDetail, setPositiveDetail] = useState<string>("");
  const [negativeDetail, setNegativeDetail] = useState<string>("");
  const [anythingElse, setAnythingElse] = useState<string>("");
  const [showPositiveDetail, setShowPositiveDetail] = useState(false);
  const [showNegativeDetail, setShowNegativeDetail] = useState(false);
  const [copied, setCopied] = useState(false);

  // Captcha state
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);

  // Submission result
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);

  // ============================================================
  // TOKEN VALIDATION
  // ============================================================

  useEffect(() => {
    async function validateToken() {
      try {
        const res = await fetch(`/api/feedback/${token}`);
        const data: TokenValidation = await res.json();

        if (!data.valid) {
          setErrorType(data.error || "UNKNOWN");
          setErrorMessage(data.errorMessage || "This link is not valid.");
          setPageState("error");
          return;
        }

        setTenantName(data.tenantName || "Restaurant");
        setSettings(data.settings || null);
        setPageState("form");
      } catch (error) {
        console.error("Error validating token:", error);
        setErrorMessage("Something went wrong. Please try again.");
        setPageState("error");
      }
    }

    validateToken();
  }, [token]);

  // ============================================================
  // FORM HANDLERS
  // ============================================================

  const toggleTheme = useCallback((theme: string, type: "positive" | "negative") => {
    if (type === "positive") {
      setPositiveThemes((prev) =>
        prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme]
      );
      setNegativeThemes((prev) => prev.filter((t) => t !== theme));
    } else {
      setNegativeThemes((prev) =>
        prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme]
      );
      setPositiveThemes((prev) => prev.filter((t) => t !== theme));
    }
  }, []);

  const handleSubmit = async () => {
    if (rating === 0) return;

    if (settings?.captchaEnabled && !captchaToken) {
      setCaptchaError("Please complete the verification");
      return;
    }

    setPageState("submitting");
    setCaptchaError(null);

    try {
      const res = await fetch(`/api/feedback/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          overallRating: rating,
          positiveThemes,
          negativeThemes,
          positiveDetail: positiveDetail || undefined,
          negativeDetail: negativeDetail || undefined,
          anythingElse: anythingElse || undefined,
          consentGiven: true,
          captchaToken: captchaToken || undefined,
        }),
      });

      const data: SubmissionResult = await res.json();

      if (!data.success) {
        setCaptchaToken(null);

        if (data.error === "CAPTCHA_FAILED" || data.error === "CAPTCHA_REQUIRED") {
          setCaptchaError(data.errorMessage || "Verification failed. Please try again.");
          setPageState("form");
          return;
        }

        setErrorMessage(data.errorMessage || "Failed to submit feedback.");
        setPageState("error");
        return;
      }

      setSubmissionResult(data);
      setPageState("success");
    } catch (error) {
      console.error("Error submitting feedback:", error);
      setErrorMessage("Failed to submit feedback. Please try again.");
      setPageState("error");
    }
  };

  const copyCode = useCallback((code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, []);

  // ============================================================
  // RENDER HELPERS
  // ============================================================

  const headerColor = settings?.headerColor || "#1e40af";
  const accentColor = settings?.accentColor || "#3b82f6";

  const getIncentiveContent = () => {
    if (!settings) return null;
    switch (settings.incentiveType) {
      case "DISCOUNT":
        return {
          icon: <Percent className="h-5 w-5" />,
          title: settings.incentiveTitle || `Get ${settings.discountPercent}% OFF`,
          description: settings.incentiveDescription || "Your next visit",
        };
      case "PRIZE_DRAW":
        return {
          icon: <Trophy className="h-5 w-5" />,
          title: settings.prizeDrawTitle || "Win a Free Meal!",
          description: settings.prizeDrawDescription || "Every review is an entry",
        };
      case "CUSTOM":
        return {
          icon: <Gift className="h-5 w-5" />,
          title: settings.incentiveTitle || "Thank You!",
          description: settings.incentiveDescription || "We appreciate your feedback",
        };
      default:
        return null;
    }
  };

  // ============================================================
  // LOADING STATE
  // ============================================================

  if (pageState === "loading") {
    return <LoadingSkeleton />;
  }

  // ============================================================
  // ERROR STATE
  // ============================================================

  if (pageState === "error") {
    return <ErrorState errorType={errorType} errorMessage={errorMessage} />;
  }

  // ============================================================
  // SUCCESS STATE
  // ============================================================

  if (pageState === "success" && submissionResult) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
        {/* Header */}
        <div
          className="px-4 pt-12 pb-16 text-white text-center relative overflow-hidden"
          style={{ backgroundColor: headerColor }}
        >
          {/* Background decoration */}
          <div 
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: `radial-gradient(circle at 20% 50%, white 0%, transparent 50%), 
                               radial-gradient(circle at 80% 50%, white 0%, transparent 50%)`
            }}
          />
          
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 200, damping: 15, delay: 0.1 }}
            className="relative inline-flex p-4 bg-white/20 backdrop-blur-sm rounded-full mb-5"
          >
            <CheckCircle2 className="h-12 w-12" strokeWidth={1.5} />
          </motion.div>
          
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-3xl font-bold mb-2 relative"
          >
            Thank You!
          </motion.h1>
          
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-white/90 text-lg relative"
          >
            Your feedback helps {tenantName} improve
          </motion.p>
        </div>

        <div className="px-4 -mt-8 pb-8 space-y-4 max-w-md mx-auto relative z-10">
          {/* Discount Incentive Card */}
          {submissionResult.incentiveType === "DISCOUNT" && submissionResult.redemptionCode && (
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100"
            >
              <div
                className="px-5 py-4 text-white flex items-center gap-3"
                style={{ backgroundColor: accentColor }}
              >
                <div className="p-2 bg-white/20 rounded-lg">
                  <Percent className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-semibold text-lg">
                    {submissionResult.discountPercent}% OFF
                  </p>
                  <p className="text-sm text-white/80">Your next visit</p>
                </div>
              </div>
              
              <div className="p-5 space-y-5">
                {/* Redemption Code - Prominent display */}
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 mb-3 font-medium">
                    Show this code to redeem
                  </p>
                  <motion.div
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.5, type: "spring" }}
                    className="inline-block px-8 py-5 rounded-2xl text-4xl font-mono font-black tracking-[0.4em]"
                    style={{ 
                      backgroundColor: `${accentColor}10`, 
                      color: accentColor,
                      textShadow: "0 1px 2px rgba(0,0,0,0.1)"
                    }}
                  >
                    {submissionResult.redemptionCode}
                  </motion.div>
                  <p className="text-xs text-gray-400 mt-3">
                    Staff will verify this code
                  </p>
                </div>

                {/* Reference Code */}
                <div className="border-t border-gray-100 pt-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-gray-500 mb-1">Reference code</p>
                      <code className="text-sm font-mono text-gray-600 break-all">
                        {submissionResult.incentiveCode}
                      </code>
                    </div>
                    <button
                      onClick={() => copyCode(submissionResult.incentiveCode!)}
                      className="p-2.5 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors flex-shrink-0"
                      aria-label="Copy code"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>

                {submissionResult.discountTerms && (
                  <p className="text-xs text-gray-500 leading-relaxed">
                    {submissionResult.discountTerms}
                  </p>
                )}

                {/* Tip card */}
                <div className="bg-amber-50 rounded-xl p-4 flex gap-3">
                  <Sparkles className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 leading-relaxed">
                    Show the code above to your server on your next visit to claim your discount.
                  </p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Prize Draw Card */}
          {submissionResult.incentiveType === "PRIZE_DRAW" && submissionResult.incentiveCode && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100"
            >
              <div
                className="px-5 py-4 text-white flex items-center gap-3"
                style={{ backgroundColor: accentColor }}
              >
                <div className="p-2 bg-white/20 rounded-lg">
                  <Trophy className="h-5 w-5" />
                </div>
                <span className="font-semibold text-lg">You&apos;re Entered!</span>
              </div>
              <div className="p-5 space-y-4">
                <div className="text-center py-4">
                  <p className="text-gray-600 mb-3">Your entry number</p>
                  <code className="text-3xl font-mono font-bold tracking-wider text-gray-900">
                    {submissionResult.incentiveCode}
                  </code>
                </div>
                {submissionResult.prizeDrawTerms && (
                  <p className="text-xs text-gray-500 text-center leading-relaxed">
                    {submissionResult.prizeDrawTerms}
                  </p>
                )}
              </div>
            </motion.div>
          )}

          {/* Google Review Prompt */}
          {submissionResult.redirectToGoogleReview && submissionResult.googleReviewUrl && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="bg-white rounded-2xl shadow-lg border border-gray-100 p-5"
            >
              <div className="flex items-start gap-4">
                <div className="p-3 bg-blue-50 rounded-xl">
                  <Star className="h-6 w-6 text-blue-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 text-lg mb-1">
                    Loved your experience?
                  </h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Share it with others by leaving a Google review!
                  </p>
                  <a
                    href={submissionResult.googleReviewUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors shadow-sm"
                  >
                    Leave a Review
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </motion.div>
          )}

          {/* Close message */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="text-center text-sm text-gray-400 pt-4"
          >
            You can now close this page
          </motion.p>
        </div>
      </div>
    );
  }

  // ============================================================
  // FORM STATE
  // ============================================================

  const incentiveContent = getIncentiveContent();
  const isLowRating = rating > 0 && rating <= 2;
  const themeOptions = settings?.themeOptions || [];

  return (
    <div className="min-h-screen bg-gray-50 pb-28">
      {/* Header */}
      <div
        className="px-4 pt-8 pb-12 text-white text-center relative overflow-hidden"
        style={{ backgroundColor: headerColor }}
      >
        {/* Subtle background pattern */}
        <div 
          className="absolute inset-0 opacity-5"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='20' height='20' viewBox='0 0 20 20' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='white' fill-opacity='1' fill-rule='evenodd'%3E%3Ccircle cx='3' cy='3' r='3'/%3E%3C/g%3E%3C/svg%3E")`
          }}
        />
        
        <motion.div 
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="relative inline-flex p-3.5 bg-white/20 backdrop-blur-sm rounded-full mb-4"
        >
          <Sparkles className="h-7 w-7" />
        </motion.div>
        
        <motion.h1 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-2xl font-bold mb-1 relative"
        >
          {tenantName}
        </motion.h1>
        
        <motion.p 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-white/90 text-lg relative"
        >
          How was your experience?
        </motion.p>
      </div>

      {/* Incentive Card */}
      {incentiveContent && settings && settings.incentiveType !== "NONE" && (
        <div className="px-4 -mt-6 relative z-10">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="rounded-2xl p-4 text-white shadow-lg flex items-center gap-4"
            style={{ backgroundColor: accentColor }}
          >
            <div className="p-2.5 bg-white/20 backdrop-blur-sm rounded-xl flex-shrink-0">
              {incentiveContent.icon}
            </div>
            <div>
              <p className="font-semibold text-lg">{incentiveContent.title}</p>
              <p className="text-sm text-white/80">{incentiveContent.description}</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Form Content */}
      <div className="px-4 py-6 space-y-5 max-w-lg mx-auto">
        {/* Star Rating Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >
          <h2 className="text-center text-gray-800 font-semibold text-lg mb-5">
            Rate your experience
          </h2>
          
          <StarRating
            rating={rating}
            hoverRating={hoverRating}
            onRate={setRating}
            onHover={setHoverRating}
            onLeave={() => setHoverRating(0)}
          />

          {/* Empathy message for low ratings */}
          <AnimatePresence>
            {isLowRating && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 16 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-amber-50 rounded-xl p-4 text-center">
                  <p className="text-amber-800 text-sm leading-relaxed">
                    We&apos;re sorry to hear that. Please tell us what went wrong so we can make it right.
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* What was great? */}
        <AnimatePresence>
          {rating > 0 && (
            <motion.div
              {...slideUp}
              transition={{ delay: 0.05 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
            >
              <div className="flex items-center gap-2.5 mb-5">
                <div className="p-2 bg-emerald-50 rounded-lg">
                  <Heart className="h-5 w-5 text-emerald-600" />
                </div>
                <h2 className="text-gray-800 font-semibold text-lg">What was great?</h2>
              </div>

              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="flex flex-wrap gap-2 mb-4"
                role="group"
                aria-label="Positive feedback themes"
              >
                {themeOptions.map((theme) => (
                  <ThemeChip
                    key={`positive-${theme}`}
                    theme={theme}
                    type="positive"
                    isSelected={positiveThemes.includes(theme)}
                    isDisabled={negativeThemes.includes(theme)}
                    onToggle={() => toggleTheme(theme, "positive")}
                    accentColor={accentColor}
                  />
                ))}
              </motion.div>

              {/* Add details toggle */}
              {positiveThemes.length > 0 && !showPositiveDetail && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  type="button"
                  onClick={() => setShowPositiveDetail(true)}
                  className="text-sm font-medium hover:underline flex items-center gap-1.5 transition-colors"
                  style={{ color: accentColor }}
                >
                  <Plus className="h-4 w-4" />
                  Add details (optional)
                </motion.button>
              )}

              {/* Details input */}
              <AnimatePresence>
                {showPositiveDetail && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <textarea
                      value={positiveDetail}
                      onChange={(e) => setPositiveDetail(e.target.value)}
                      placeholder="Tell us more about what you loved..."
                      className="w-full mt-4 p-4 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow"
                      rows={3}
                      aria-label="Positive feedback details"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* What could be better? */}
        <AnimatePresence>
          {rating > 0 && (
            <motion.div
              {...slideUp}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
            >
              <div className="flex items-center gap-2.5 mb-5">
                <div className="p-2 bg-amber-50 rounded-lg">
                  <ThumbsDown className="h-5 w-5 text-amber-600" />
                </div>
                <h2 className="text-gray-800 font-semibold text-lg">What could be better?</h2>
              </div>

              <motion.div
                variants={staggerContainer}
                initial="initial"
                animate="animate"
                className="flex flex-wrap gap-2 mb-4"
                role="group"
                aria-label="Negative feedback themes"
              >
                {themeOptions.map((theme) => (
                  <ThemeChip
                    key={`negative-${theme}`}
                    theme={theme}
                    type="negative"
                    isSelected={negativeThemes.includes(theme)}
                    isDisabled={positiveThemes.includes(theme)}
                    onToggle={() => toggleTheme(theme, "negative")}
                    accentColor={accentColor}
                  />
                ))}
              </motion.div>

              {/* Add details toggle */}
              {negativeThemes.length > 0 && !showNegativeDetail && (
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  type="button"
                  onClick={() => setShowNegativeDetail(true)}
                  className="text-sm font-medium hover:underline flex items-center gap-1.5 transition-colors"
                  style={{ color: accentColor }}
                >
                  <Plus className="h-4 w-4" />
                  Add details (optional)
                </motion.button>
              )}

              {/* Details input */}
              <AnimatePresence>
                {showNegativeDetail && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <textarea
                      value={negativeDetail}
                      onChange={(e) => setNegativeDetail(e.target.value)}
                      placeholder="Help us understand what we can improve..."
                      className="w-full mt-4 p-4 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                      rows={3}
                      aria-label="Negative feedback details"
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Anything else? */}
        <AnimatePresence>
          {rating > 0 && (
            <motion.div
              {...slideUp}
              transition={{ delay: 0.15 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
            >
              <div className="flex items-center gap-2.5 mb-5">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                </div>
                <h2 className="text-gray-800 font-semibold text-lg">
                  Anything else?
                </h2>
                <span className="text-xs text-gray-400 font-medium">(optional)</span>
              </div>

              <textarea
                value={anythingElse}
                onChange={(e) => setAnythingElse(e.target.value)}
                placeholder="Share any additional feedback..."
                className="w-full p-4 border border-gray-200 rounded-xl text-sm resize-none focus:outline-none focus:ring-2 focus:border-transparent transition-shadow"
                rows={3}
                aria-label="Additional feedback"
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Captcha Section */}
        <AnimatePresence>
          {rating > 0 && settings?.captchaEnabled && settings.captchaSiteKey && (
            <motion.div
              {...slideUp}
              transition={{ delay: 0.2 }}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
            >
              <div className="flex items-center gap-2.5 mb-5">
                <div className="p-2 bg-gray-100 rounded-lg">
                  <Shield className="h-5 w-5 text-gray-600" />
                </div>
                <h2 className="text-gray-800 font-semibold">Verification</h2>
              </div>

              <div className="flex justify-center">
                {settings.captchaProvider === "hcaptcha" && (
                  <div
                    id="hcaptcha-container"
                    className="h-captcha"
                    data-sitekey={settings.captchaSiteKey}
                    data-callback="onHCaptchaSuccess"
                    data-expired-callback="onHCaptchaExpire"
                  />
                )}
                {settings.captchaProvider === "turnstile" && (
                  <div
                    id="turnstile-container"
                    className="cf-turnstile"
                    data-sitekey={settings.captchaSiteKey}
                    data-callback="onTurnstileSuccess"
                    data-expired-callback="onTurnstileExpire"
                  />
                )}
              </div>

              {captchaError && (
                <p className="text-red-500 text-sm text-center mt-4 font-medium">
                  {captchaError}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Captcha Scripts */}
      {settings?.captchaEnabled && settings.captchaSiteKey && (
        <>
          {settings.captchaProvider === "hcaptcha" && (
            <Script
              src="https://js.hcaptcha.com/1/api.js"
              async
              defer
              onLoad={() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as any).onHCaptchaSuccess = (token: string) => {
                  setCaptchaToken(token);
                  setCaptchaError(null);
                };
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as any).onHCaptchaExpire = () => {
                  setCaptchaToken(null);
                };
              }}
            />
          )}
          {settings.captchaProvider === "turnstile" && (
            <Script
              src="https://challenges.cloudflare.com/turnstile/v0/api.js"
              async
              defer
              onLoad={() => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as any).onTurnstileSuccess = (token: string) => {
                  setCaptchaToken(token);
                  setCaptchaError(null);
                };
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (window as any).onTurnstileExpire = () => {
                  setCaptchaToken(null);
                };
              }}
            />
          )}
        </>
      )}

      {/* Fixed Submit Button */}
      <AnimatePresence>
        {rating > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-gray-200 p-4 shadow-2xl"
          >
            <div className="max-w-lg mx-auto">
              <motion.button
                type="button"
                onClick={handleSubmit}
                disabled={pageState === "submitting"}
                whileTap={{ scale: 0.98 }}
                className="w-full py-4 rounded-xl text-white font-semibold text-lg transition-all disabled:opacity-70 flex items-center justify-center gap-2.5 shadow-lg"
                style={{ backgroundColor: accentColor }}
                aria-label="Submit feedback"
              >
                {pageState === "submitting" ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Feedback</span>
                    <ChevronRight className="h-5 w-5" />
                  </>
                )}
              </motion.button>
              
              {/* Progress indicator */}
              <div className="flex justify-center gap-1.5 mt-3">
                <div 
                  className="h-1 rounded-full transition-all duration-300"
                  style={{ 
                    width: rating > 0 ? "20px" : "8px",
                    backgroundColor: rating > 0 ? accentColor : "#d1d5db"
                  }}
                />
                <div 
                  className="h-1 rounded-full transition-all duration-300"
                  style={{ 
                    width: positiveThemes.length > 0 || negativeThemes.length > 0 ? "20px" : "8px",
                    backgroundColor: positiveThemes.length > 0 || negativeThemes.length > 0 ? accentColor : "#d1d5db"
                  }}
                />
                <div 
                  className="h-1 w-2 rounded-full bg-gray-300"
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
