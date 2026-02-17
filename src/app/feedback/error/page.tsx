"use client";

import { useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Clock,
  CheckCheck,
  Ban,
  RefreshCw,
  FileX,
  ShieldX,
} from "lucide-react";
import { Suspense } from "react";

// ============================================================
// ERROR CONFIGURATIONS
// ============================================================

const ERROR_CONFIG: Record<string, {
  icon: typeof AlertCircle;
  iconBg: string;
  iconColor: string;
  title: string;
  subtitle: string;
  description: string;
  action?: {
    label: string;
    type: "reload" | "close";
  };
}> = {
  MISSING_REF: {
    icon: FileX,
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
    title: "Missing Information",
    subtitle: "Receipt reference not provided",
    description: "The feedback link is incomplete. Please scan the QR code on your receipt again.",
    action: { label: "Try Again", type: "reload" },
  },
  INVALID_TIMESTAMP: {
    icon: Clock,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-500",
    title: "Invalid Link",
    subtitle: "Link format is incorrect",
    description: "This feedback link appears to be corrupted. Please scan the QR code on your receipt again.",
    action: { label: "Try Again", type: "reload" },
  },
  EXPIRED_LINK: {
    icon: Clock,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    title: "Link Expired",
    subtitle: "This link is no longer active",
    description: "Feedback links are only valid for 24 hours after the receipt is printed. Please ask for a new receipt.",
  },
  INVALID_SIGNATURE: {
    icon: ShieldX,
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
    title: "Security Check Failed",
    subtitle: "This link could not be verified",
    description: "The link may have been modified or is invalid. Please scan the original QR code from your receipt.",
    action: { label: "Try Again", type: "reload" },
  },
  CHANNEL_NOT_FOUND: {
    icon: Ban,
    iconBg: "bg-gray-100",
    iconColor: "text-gray-500",
    title: "Not Available",
    subtitle: "Feedback system not configured",
    description: "This restaurant hasn't set up their feedback system yet. Please speak with a team member if you'd like to share your experience.",
  },
  CHANNEL_INACTIVE: {
    icon: Ban,
    iconBg: "bg-gray-100",
    iconColor: "text-gray-500",
    title: "Temporarily Unavailable",
    subtitle: "Feedback collection is paused",
    description: "The restaurant has temporarily paused feedback collection. Please try again later or speak with a team member.",
  },
  ALREADY_SUBMITTED: {
    icon: CheckCheck,
    iconBg: "bg-emerald-50",
    iconColor: "text-emerald-600",
    title: "Already Submitted",
    subtitle: "We've received your feedback",
    description: "You've already shared your experience for this visit. Thank you for taking the time to help us improve!",
    action: { label: "Close", type: "close" },
  },
  EXPIRED_RECEIPT: {
    icon: Clock,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    title: "Receipt Expired",
    subtitle: "Feedback window has closed",
    description: "The feedback period for this receipt has ended. For the best experience, please share your thoughts within a few days of your visit.",
  },
  DUPLICATE_RECEIPT: {
    icon: AlertCircle,
    iconBg: "bg-amber-50",
    iconColor: "text-amber-600",
    title: "Receipt Already Used",
    subtitle: "Feedback already collected",
    description: "We've already received feedback for this receipt. Each receipt can only be used once to ensure quality feedback.",
  },
  MINT_FAILED: {
    icon: AlertCircle,
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
    title: "Something Went Wrong",
    subtitle: "Could not start feedback",
    description: "We encountered an issue setting up your feedback form. Please try again or ask your server for assistance.",
    action: { label: "Try Again", type: "reload" },
  },
  INTERNAL_ERROR: {
    icon: AlertCircle,
    iconBg: "bg-red-50",
    iconColor: "text-red-500",
    title: "Server Error",
    subtitle: "Something unexpected happened",
    description: "We're sorry, but something went wrong on our end. Please try again in a moment.",
    action: { label: "Try Again", type: "reload" },
  },
};

const DEFAULT_ERROR = {
  icon: AlertCircle,
  iconBg: "bg-red-50",
  iconColor: "text-red-500",
  title: "Error",
  subtitle: "Something went wrong",
  description: "We encountered an unexpected error. Please try again or scan the QR code on your receipt.",
  action: { label: "Try Again", type: "reload" as const },
};

// ============================================================
// ERROR CONTENT COMPONENT
// ============================================================

function ErrorContent() {
  const searchParams = useSearchParams();
  const code = searchParams.get("code") || "UNKNOWN";
  
  const config = ERROR_CONFIG[code] || DEFAULT_ERROR;
  const Icon = config.icon;

  const handleAction = () => {
    if (config.action?.type === "reload") {
      window.location.reload();
    } else if (config.action?.type === "close") {
      window.close();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="max-w-sm w-full text-center"
      >
        {/* Icon */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 400, damping: 25 }}
          className={`w-20 h-20 ${config.iconBg} rounded-full mx-auto mb-6 flex items-center justify-center`}
        >
          <Icon className={`h-10 w-10 ${config.iconColor}`} strokeWidth={1.5} />
        </motion.div>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-2xl font-bold text-gray-900 mb-2"
        >
          {config.title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
          className="text-gray-500 font-medium mb-4"
        >
          {config.subtitle}
        </motion.p>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-gray-600 text-sm leading-relaxed mb-8"
        >
          {config.description}
        </motion.p>

        {/* Action Button */}
        {config.action && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            onClick={handleAction}
            className="inline-flex items-center gap-2 px-6 py-3 bg-gray-900 text-white rounded-xl font-medium hover:bg-gray-800 transition-colors shadow-sm"
          >
            {config.action.type === "reload" && <RefreshCw className="h-4 w-4" />}
            {config.action.label}
          </motion.button>
        )}

        {/* Footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-xs text-gray-400 mt-8"
        >
          Need help? Ask your server for assistance
        </motion.p>
      </motion.div>
    </div>
  );
}

// ============================================================
// PAGE COMPONENT
// ============================================================

export default function FeedbackErrorPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">
          <div className="animate-pulse">
            <div className="w-20 h-20 bg-gray-200 rounded-full mx-auto mb-6" />
            <div className="h-6 w-40 bg-gray-200 rounded mx-auto mb-2" />
            <div className="h-4 w-48 bg-gray-200 rounded mx-auto" />
          </div>
        </div>
      }
    >
      <ErrorContent />
    </Suspense>
  );
}
