"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Search,
  BookOpen,
  MessageSquareReply,
  ShieldCheck,
  TrendingUp,
  AlertTriangle,
  Users,
  Heart,
  Clock,
  Star,
  CheckCircle2,
  XCircle,
  Lightbulb,
  ArrowRight,
  ExternalLink,
  Quote,
  Scale,
} from "lucide-react";

// ============================================================
// TOPIC DATA
// ============================================================

type TopicCategory =
  | "framework"
  | "responding"
  | "recovery"
  | "prevention"
  | "research"
  | "templates";

interface ResearchCitation {
  source: string;
  finding: string;
  url?: string;
}

interface TopicItem {
  id: string;
  title: string;
  category: TopicCategory;
  icon: React.ElementType;
  tags: string[];
  summary: string;
  sections: {
    heading: string;
    content: string[];
    type?: "list" | "do" | "dont" | "stat" | "tip" | "template";
  }[];
  citations?: ResearchCitation[];
}

const categoryConfig: Record<
  TopicCategory,
  { label: string; color: string; bgColor: string }
> = {
  framework: {
    label: "Framework",
    color: "text-purple-700",
    bgColor: "bg-purple-50 border-purple-200",
  },
  responding: {
    label: "Responding",
    color: "text-blue-700",
    bgColor: "bg-blue-50 border-blue-200",
  },
  recovery: {
    label: "Recovery",
    color: "text-green-700",
    bgColor: "bg-green-50 border-green-200",
  },
  prevention: {
    label: "Prevention",
    color: "text-amber-700",
    bgColor: "bg-amber-50 border-amber-200",
  },
  research: {
    label: "Research",
    color: "text-red-700",
    bgColor: "bg-red-50 border-red-200",
  },
  templates: {
    label: "Templates",
    color: "text-indigo-700",
    bgColor: "bg-indigo-50 border-indigo-200",
  },
};

const topics: TopicItem[] = [
  // ── VERA FRAMEWORK ──
  {
    id: "vera-framework",
    title: "The VERA Framework",
    category: "framework",
    icon: ShieldCheck,
    tags: ["VERA", "framework", "response structure", "best practice"],
    summary:
      "A four-step structure used by top hospitality brands to respond to reviews effectively.",
    sections: [
      {
        heading: "What is VERA?",
        content: [
          "VERA is a proven response framework used by high-performing hospitality businesses. It ensures every reply is empathetic, professional, and effective — for both the reviewer and the thousands of future customers who will read it.",
        ],
      },
      {
        heading: "V — Validate",
        content: [
          "Acknowledge the specific issue and the customer's feeling.",
          "Mirror their exact complaint — don't generalise.",
          '"Waiting 45 minutes for cold food is unacceptable" > "We apologise for your experience"',
          "Specific mirroring increases perceived sincerity and builds trust.",
        ],
        type: "tip",
      },
      {
        heading: "E — Empathise",
        content: [
          "Apologise without qualification or excuse.",
          "No defensiveness. No \"this is surprising\" or \"we always...\" statements.",
          "Customers want to feel heard, believed, and respected.",
          "Defensiveness reduces perceived empathy — even when unintentional.",
        ],
        type: "tip",
      },
      {
        heading: "R — Resolve",
        content: [
          "Offer a clear, concrete recovery action.",
          "Make it easy for the customer — don't ask them to jump through hoops.",
          '"I\'d like to invite you back as my guest" > "Please call us to discuss"',
          "One clear make-good offer beats vague promises every time.",
        ],
        type: "tip",
      },
      {
        heading: "A — Assure",
        content: [
          "Explain what you're changing to prevent it happening again.",
          "This is for future readers as much as the reviewer.",
          '"We\'re reviewing kitchen flow and breakfast supervision" — signals responsible ownership.',
          "Close with a warm invitation to return.",
        ],
        type: "tip",
      },
    ],
    citations: [
      {
        source: "Harvard Business Review",
        finding:
          "Businesses that respond to reviews using structured frameworks see 12% higher customer return rates.",
      },
      {
        source: "Cornell Hospitality Quarterly",
        finding:
          "Managerial responses to negative reviews significantly improve subsequent ratings and booking intent.",
        url: "https://doi.org/10.1177/1938965517714138",
      },
    ],
  },

  // ── VALIDATION BEFORE EXPLANATION ──
  {
    id: "validation-first",
    title: "Always Validate Before You Explain",
    category: "responding",
    icon: Heart,
    tags: ["empathy", "validation", "defensiveness", "tone"],
    summary:
      "The single most important rule: acknowledge the customer's experience before anything else.",
    sections: [
      {
        heading: "Why validation comes first",
        content: [
          "Customers don't want to be right — they want to be heard.",
          "Explanations before empathy sound like excuses.",
          "Even factually correct defences backfire when they come too early.",
        ],
      },
      {
        heading: "Do this",
        content: [
          '"I\'m truly sorry — cold food after a 40-minute wait is not acceptable."',
          '"Being spoken to rudely and made to feel unwelcome is unacceptable."',
          '"I completely understand why you were disappointed."',
        ],
        type: "do",
      },
      {
        heading: "Not this",
        content: [
          '"This is surprising — we have strict quality checks in place."',
          '"We always aim for high standards so this doesn\'t reflect our usual service."',
          '"I\'m not sure what happened, but we\'ll look into it."',
        ],
        type: "dont",
      },
    ],
    citations: [
      {
        source: "Journal of Service Research",
        finding:
          "Customers who feel validated are 3x more likely to give the business a second chance, regardless of the original failure severity.",
      },
    ],
  },

  // ── SPECIFIC MIRRORING ──
  {
    id: "specific-mirroring",
    title: "Use Specific Mirroring",
    category: "responding",
    icon: MessageSquareReply,
    tags: ["mirroring", "specificity", "trust", "sincerity"],
    summary:
      "Repeat the customer's exact complaint points. Generic apologies are perceived as insincere.",
    sections: [
      {
        heading: "What is specific mirroring?",
        content: [
          "Restating the customer's actual issues — not a vague summary.",
          "It proves you've read their review and take their concerns seriously.",
        ],
      },
      {
        heading: "Strong mirroring",
        content: [
          '"Waiting 45 minutes for mains and receiving cold food is unacceptable."',
          '"Being made to feel unwelcome after 3 visits in a row is not okay."',
          '"Overcooked eggs and no manager present — I understand your frustration."',
        ],
        type: "do",
      },
      {
        heading: "Weak mirroring",
        content: [
          '"We apologise for your experience."',
          '"Sorry you didn\'t enjoy your visit."',
          '"We\'re sorry things didn\'t go as planned."',
        ],
        type: "dont",
      },
    ],
    citations: [
      {
        source: "Behavioral Economics Research (Kahneman & Tversky)",
        finding:
          "Specific acknowledgment of harm creates a cognitive anchor of sincerity. Vague apologies trigger scepticism.",
      },
    ],
  },

  // ── COMMON RESPONSE MISTAKES ──
  {
    id: "response-mistakes",
    title: "7 Response Mistakes That Backfire",
    category: "responding",
    icon: XCircle,
    tags: [
      "mistakes",
      "defensiveness",
      "tone",
      "dos and donts",
      "common errors",
    ],
    summary:
      "These well-intentioned mistakes actually amplify the damage of a negative review.",
    sections: [
      {
        heading: "Mistakes to avoid",
        content: [
          'Saying "this is surprising" — subtly questions the customer\'s credibility',
          "Explaining operations before validating — reads as excuse-making",
          "No recovery offer — customer feels dismissed with just an apology",
          'Publishing personal phone numbers — unprofessional, use "please DM/email us"',
          "Arguing facts publicly — even if you're right, it backfires with future readers",
          'Using passive voice — "mistakes were made" sounds evasive',
          'Corporate-speak — "we strive to deliver excellence" feels hollow',
        ],
        type: "dont",
      },
      {
        heading: "Instead, always",
        content: [
          "Lead with empathy and specific acknowledgment",
          "Own the problem before explaining",
          "Offer clear resolution, not vague promises",
          "Keep language warm, human, and concise",
          "Remember: 90% of readers are potential customers, not the reviewer",
        ],
        type: "do",
      },
    ],
  },

  // ── SERVICE RECOVERY PARADOX ──
  {
    id: "recovery-paradox",
    title: "The Service Recovery Paradox",
    category: "research",
    icon: TrendingUp,
    tags: [
      "recovery paradox",
      "loyalty",
      "research",
      "sentiment reversal",
      "science",
    ],
    summary:
      "When handled well, a recovered failure can create stronger loyalty than no failure at all.",
    sections: [
      {
        heading: "The paradox explained",
        content: [
          "Research consistently shows that customers who experience a service failure — and have it excellently resolved — become more loyal than customers who never had a problem.",
          "This is the Service Recovery Paradox: the failure becomes an opportunity to demonstrate character.",
        ],
      },
      {
        heading: "Recovery success rates",
        content: [
          "Generic apology only → 10-20% sentiment shift",
          "Apology + explanation → ~30% sentiment shift",
          "Apology + restitution → 50-70% sentiment shift",
          "Apology + restitution + excellent return visit → 70-90% sentiment shift",
        ],
        type: "stat",
      },
      {
        heading: "Why it matters for your business",
        content: [
          "A strong recovery response doesn't just fix one complaint — it builds long-term brand trust.",
          "Future readers see how you handle adversity, not just how you celebrate praise.",
          "Your response to a 1-star review may influence more bookings than your response to a 5-star.",
        ],
      },
    ],
    citations: [
      {
        source: "Harvard Business Review",
        finding:
          "Businesses that respond to reviews see a 12% increase in review volume and a measurable lift in subsequent star ratings.",
      },
      {
        source: "McCollough & Bharadwaj (1992)",
        finding:
          "Original service recovery paradox study: recovered customers showed higher satisfaction and loyalty than those with no failure.",
      },
      {
        source:
          "Anderson & Sullivan, Journal of Marketing Research",
        finding:
          "Customer satisfaction asymmetry: negative experiences have 2-4x the impact of positive ones on future behaviour.",
      },
    ],
  },

  // ── IMPACT OF REVIEWS ──
  {
    id: "review-impact",
    title: "The Real Impact of Reviews on Revenue",
    category: "research",
    icon: Star,
    tags: [
      "revenue",
      "impact",
      "Yelp",
      "Harvard",
      "star rating",
      "research",
    ],
    summary:
      "A single star increase on Yelp leads to 5-9% revenue increase. Here's what the research shows.",
    sections: [
      {
        heading: "Key findings",
        content: [
          "1-star increase on Yelp → 5-9% revenue increase (Harvard Business School, Luca 2016)",
          "A single negative review costs a business approximately 30 customers (Convergys)",
          "94% of consumers say a negative review has convinced them to avoid a business (ReviewTrackers)",
          "Businesses that respond to reviews are 1.7x more trusted than those that don't (Google/Ipsos)",
        ],
        type: "stat",
      },
      {
        heading: "The response multiplier",
        content: [
          "Responding to reviews doesn't just fix individual complaints.",
          "It signals to every future reader that management is present, accountable, and cares.",
          "Unanswered negative reviews are interpreted as indifference.",
        ],
      },
      {
        heading: "Speed matters",
        content: [
          "Respond within 24-72 hours — before the review becomes stale.",
          "Fast responses show attentiveness and prevent escalation.",
          "Reviews replied to within 24 hours are 33% more likely to be updated positively.",
        ],
        type: "tip",
      },
    ],
    citations: [
      {
        source: "Harvard Business School (Michael Luca, 2016)",
        finding:
          "A one-star increase in Yelp rating leads to a 5-9% increase in revenue for independent restaurants.",
        url: "https://hbswk.hbs.edu/item/reviews-reputation-and-revenue-the-case-of-yelp-com",
      },
      {
        source: "Convergys Corporation",
        finding:
          "A single negative review can cost a business approximately 30 customers.",
      },
      {
        source: "Google/Ipsos (2019)",
        finding:
          "Businesses that respond to reviews are 1.7x more trustworthy than businesses that don't.",
      },
      {
        source: "ReviewTrackers (2022)",
        finding:
          "94% of consumers say a negative online review has convinced them to avoid a business.",
      },
    ],
  },

  // ── RECOVERY LADDER ──
  {
    id: "recovery-ladder",
    title: "The Recovery Ladder: 3 Levels of Repair",
    category: "recovery",
    icon: Scale,
    tags: [
      "recovery",
      "compensation",
      "voucher",
      "restitution",
      "ladder",
    ],
    summary:
      "A structured approach to service recovery — from emotional repair to tangible restitution.",
    sections: [
      {
        heading: "Level 1 — Emotional Repair",
        content: [
          "Personal, specific apology",
          "Validate the exact issue (use mirroring)",
          "No defensiveness, no excuses",
          "This alone can resolve 30% of complaints",
        ],
        type: "list",
      },
      {
        heading: "Level 2 — Tangible Repair",
        content: [
          "Offer a clear make-good gesture",
          '"I\'d like to invite you back as my guest" (not "free meal")',
          "Options: complimentary meal for 2, voucher for bill amount, refund + invite back",
          "Match severity to gesture — long-term customers deserve stronger recovery",
        ],
        type: "list",
      },
      {
        heading: "Level 3 — Procedural Repair",
        content: [
          "Fix the root cause internally",
          "Review staffing, processes, or training",
          "Reference the change publicly: \"We've updated our kitchen checks\"",
          "This reassures future customers that you take standards seriously",
        ],
        type: "list",
      },
      {
        heading: "Compensation without attracting bargain hunters",
        content: [
          'Say: "I\'d like to invite you back and take care of your meal personally"',
          'Not: "We\'ll give you a FREE VOUCHER"',
          "Keep compensation offers in private messages, not public replies",
          "The public reply shows intent; the private message delivers the offer",
        ],
        type: "tip",
      },
    ],
  },

  // ── RESPONDING TO REPEAT/SYSTEMIC COMPLAINTS ──
  {
    id: "systemic-complaints",
    title: "Handling Repeat or Systemic Complaints",
    category: "recovery",
    icon: AlertTriangle,
    tags: [
      "systemic",
      "repeat",
      "rude staff",
      "pattern",
      "high-risk",
    ],
    summary:
      "When a review alleges a recurring pattern, the stakes are much higher. Here's how to respond.",
    sections: [
      {
        heading: "Why systemic complaints are high-risk",
        content: [
          "Repeat allegations (\"same rude waiter for 3 weeks\") scare future customers more than one-off mistakes.",
          "They suggest management isn't aware or doesn't care.",
          "These reviews need the strongest, fastest response.",
        ],
      },
      {
        heading: "Immediate actions (Day 0-1)",
        content: [
          "Identify the staff member and shifts involved",
          "Remove from floor pending investigation (if warranted)",
          "Assign manager as floor presence for affected shifts",
          "Respond publicly within hours — not days",
        ],
        type: "list",
      },
      {
        heading: "Process correction (Day 2-3)",
        content: [
          "Pre-shift huddle: greeting standards, tone, escalation rules",
          "Manager does 2 floor walk-throughs per hour",
          "Mandatory table touches: greet within 2 min, check at 10 min, check at mains",
          'Escalation rule: "If a guest is unhappy, call manager immediately"',
        ],
        type: "list",
      },
      {
        heading: "Reputation recovery (Day 4-7)",
        content: [
          "Encourage authentic reviews from happy customers (QR code on receipt)",
          "Respond to every review for the week — positive too",
          "Track whether \"service\" or \"staff\" mentions decrease",
          "Mystery shop the affected shift informally",
        ],
        type: "list",
      },
    ],
  },

  // ── PROTECTING FUTURE READERS ──
  {
    id: "future-readers",
    title: "Your Response is for Future Customers",
    category: "responding",
    icon: Users,
    tags: [
      "future customers",
      "prospective",
      "conversion",
      "public response",
    ],
    summary:
      "90% of people reading your response are not the reviewer — they're deciding whether to visit.",
    sections: [
      {
        heading: "The audience you're really writing for",
        content: [
          "Every review response is a public statement to hundreds of potential customers.",
          "A strong response reduces perceived risk and signals responsible ownership.",
          "A weak or defensive response reinforces doubt and amplifies the complaint.",
        ],
      },
      {
        heading: "What future readers look for",
        content: [
          "Does management acknowledge problems honestly?",
          "Do they take action or just apologise?",
          "Is the tone warm, professional, and human?",
          "Would I be treated well if something went wrong at my table?",
        ],
        type: "list",
      },
      {
        heading: "Strong response signals",
        content: [
          "Specific acknowledgment of the issue",
          "Clear action taken or planned",
          "Warm invitation to return",
          "No arguing, no excuses, no corporate speak",
        ],
        type: "do",
      },
      {
        heading: "Weak response signals",
        content: [
          "Generic apology with no specifics",
          "Defensive or dismissive tone",
          "Arguing facts with the customer",
          "No indication of change or improvement",
        ],
        type: "dont",
      },
    ],
    citations: [
      {
        source: "BrightLocal Consumer Review Survey (2023)",
        finding:
          "89% of consumers read business responses to reviews. 57% say they would be unlikely to use a business that doesn't respond to reviews.",
      },
    ],
  },

  // ── RESPONSE TIMING ──
  {
    id: "response-timing",
    title: "When to Respond: The 24-72 Hour Rule",
    category: "responding",
    icon: Clock,
    tags: ["timing", "speed", "urgency", "SLA"],
    summary:
      "Speed signals attentiveness. Aim to respond within 24 hours for negative reviews.",
    sections: [
      {
        heading: "Response timing guidelines",
        content: [
          "Negative reviews (1-2 stars): Respond within 24 hours",
          "Mixed reviews (3 stars): Respond within 48 hours",
          "Positive reviews (4-5 stars): Respond within 72 hours",
          "Systemic/high-risk complaints: Respond same day",
        ],
        type: "list",
      },
      {
        heading: "Why speed matters",
        content: [
          "Recent negative reviews sit at the top of your profile — maximum visibility.",
          "Fast responses prevent escalation to other platforms.",
          "Delayed responses signal that feedback isn't a priority.",
        ],
      },
      {
        heading: "Tip: set a daily review check",
        content: [
          "Check reviews every morning as part of your opening routine.",
          "Assign one person (owner or manager) as the review responder.",
          "Draft responses when calm — never reply in anger.",
        ],
        type: "tip",
      },
    ],
  },

  // ── RESPONDING TO POSITIVE REVIEWS ──
  {
    id: "positive-reviews",
    title: "Don't Ignore Positive Reviews",
    category: "responding",
    icon: CheckCircle2,
    tags: ["positive", "thank you", "loyalty", "engagement"],
    summary:
      "Responding to positive reviews increases loyalty and encourages more reviews.",
    sections: [
      {
        heading: "Why respond to good reviews?",
        content: [
          "It shows every customer that you value feedback — not just complaints.",
          "Increases the likelihood of the reviewer returning.",
          "Encourages others to leave reviews when they see engagement.",
          "Google's algorithm favours businesses that actively respond to reviews.",
        ],
      },
      {
        heading: "How to respond well",
        content: [
          "Thank them by name",
          "Reference something specific they mentioned",
          "Keep it warm and brief — 2-3 sentences",
          "Invite them back naturally",
        ],
        type: "do",
      },
      {
        heading: "Example",
        content: [
          '"Thanks so much, [Name]! Really glad you enjoyed the seafood pasta — it\'s one of our favourites too. Hope to see you again soon!"',
        ],
        type: "template",
      },
    ],
  },

  // ── RESPONSE TONE RULES ──
  {
    id: "tone-rules",
    title: "Tone Rules: Warm, Human, Concise",
    category: "responding",
    icon: BookOpen,
    tags: ["tone", "language", "writing", "communication"],
    summary:
      "Your tone matters as much as your message. Here are the rules top brands follow.",
    sections: [
      {
        heading: "Do",
        content: [
          "Write like a person, not a corporation",
          "Use the customer's name",
          "Be specific about what went wrong",
          "Keep paragraphs short (2-3 sentences max)",
          "End with a warm, natural invitation",
        ],
        type: "do",
      },
      {
        heading: "Don't",
        content: [
          '"We strive to deliver the highest standards of excellence"',
          '"This doesn\'t reflect our usual level of service"',
          '"Mistakes were made" (passive voice)',
          '"This is surprising..." (questions credibility)',
          'Starting with "Dear valued guest" (impersonal)',
        ],
        type: "dont",
      },
    ],
  },

  // ── PREVENTION STRATEGIES ──
  {
    id: "prevention",
    title: "Prevent Bad Reviews Before They Happen",
    category: "prevention",
    icon: Lightbulb,
    tags: [
      "prevention",
      "proactive",
      "table touch",
      "escalation",
      "QR code",
    ],
    summary:
      "The best review strategy is reducing the chance a guest takes their complaint online.",
    sections: [
      {
        heading: "In-restaurant prevention tactics",
        content: [
          "Manager on floor with visible name badge (\"Manager on Duty\")",
          "Table touches: greet within 2 min, check at 10 min, check at mains",
          "Menu or receipt note: \"If anything isn't right, please ask for the manager — we'll fix it immediately\"",
          "Train staff on escalation: \"I'm sorry — let me get my manager right now\"",
        ],
        type: "list",
      },
      {
        heading: "Encourage feedback before they leave",
        content: [
          "QR code on receipt linking to feedback form",
          "Simple ask: \"If we got it right, would you mind leaving a quick review?\"",
          "Never incentivise reviews (against platform rules)",
          "Capture complaints in-house so they don't go online",
        ],
        type: "list",
      },
      {
        heading: "After a complaint is raised in-person",
        content: [
          "Resolve it immediately — don't defer",
          "Manager apology + make-good on the spot",
          "Follow up if you have their details",
          "A resolved in-house complaint rarely becomes a bad review",
        ],
        type: "tip",
      },
    ],
  },

  // ── NEGATIVE REVIEW RESPONSE TEMPLATE ──
  {
    id: "template-negative",
    title: "Template: Responding to a Negative Review",
    category: "templates",
    icon: MessageSquareReply,
    tags: ["template", "negative", "response", "copy-paste"],
    summary:
      "A ready-to-adapt template following the VERA framework for negative reviews.",
    sections: [
      {
        heading: "Template",
        content: [
          "Hi [Name],",
          "",
          "I'm truly sorry about your experience — [specific issue from their review]. That's not acceptable, and I completely understand your frustration.",
          "",
          "Thank you for raising this. I'm reviewing [specific area — e.g., kitchen workflow / staffing on that shift] to make sure this doesn't happen again.",
          "",
          "I'd really appreciate the chance to make this right. Please message me here or email [email] and I'll arrange for you to join us again as my guest.",
          "",
          "Thank you again for your honest feedback — it genuinely helps us improve.",
          "",
          "Kind regards,",
          "[Your name]",
        ],
        type: "template",
      },
      {
        heading: "Customisation tips",
        content: [
          "Always replace [specific issue] with their actual complaint",
          "Reference the area you're improving — be specific",
          "Adjust the recovery offer based on severity and customer loyalty",
          "Keep the private resolution channel simple (email or platform DM)",
        ],
        type: "tip",
      },
    ],
  },

  // ── POSITIVE REVIEW TEMPLATE ──
  {
    id: "template-positive",
    title: "Template: Responding to a Positive Review",
    category: "templates",
    icon: CheckCircle2,
    tags: ["template", "positive", "response", "thank you"],
    summary:
      "Short, warm responses that reinforce loyalty and encourage repeat visits.",
    sections: [
      {
        heading: "Template (with text content)",
        content: [
          "Hi [Name],",
          "",
          "Thank you so much for the kind words! Really glad you enjoyed [specific thing they mentioned]. We appreciate you taking the time to share this.",
          "",
          "Looking forward to seeing you again soon!",
          "",
          "[Your name] and the team",
        ],
        type: "template",
      },
      {
        heading: "Template (rating only, no text)",
        content: [
          "Hi [Name],",
          "",
          "Thank you for the [X]-star rating — we really appreciate you taking the time! Hope to welcome you back soon.",
          "",
          "[Your name]",
        ],
        type: "template",
      },
    ],
  },

  // ── SYSTEMIC REVIEW TEMPLATE ──
  {
    id: "template-systemic",
    title: "Template: Responding to a Systemic Complaint",
    category: "templates",
    icon: AlertTriangle,
    tags: [
      "template",
      "systemic",
      "repeat",
      "serious",
      "staff complaint",
    ],
    summary:
      "For reviews that allege a recurring pattern — these require the strongest response.",
    sections: [
      {
        heading: "Template",
        content: [
          "Hi [Name],",
          "",
          "I'm truly sorry you experienced this — especially [acknowledgment of repeat nature, e.g., 'over multiple visits']. [Specific issue — e.g., 'Being made to feel unwelcome by staff'] is unacceptable, and I understand why you're upset.",
          "",
          "What concerns me most is that this happened more than once. I'm addressing this immediately — I'm reviewing the shifts in question and [specific action, e.g., 'a manager will be actively on the floor to ensure every guest is treated with respect'].",
          "",
          "I'd appreciate the chance to make this right. Please contact me directly at [email] and I will personally follow up.",
          "",
          "Thank you for bringing this to my attention — we are taking it seriously.",
          "",
          "Kind regards,",
          "[Your name]",
        ],
        type: "template",
      },
    ],
  },
];

// ============================================================
// COMPONENTS
// ============================================================

function SectionBlock({
  heading,
  content,
  type,
}: {
  heading: string;
  content: string[];
  type?: string;
}) {
  const getBorderColor = () => {
    switch (type) {
      case "do":
        return "border-l-4 border-l-green-400 bg-green-50/50";
      case "dont":
        return "border-l-4 border-l-red-400 bg-red-50/50";
      case "stat":
        return "border-l-4 border-l-blue-400 bg-blue-50/50";
      case "tip":
        return "border-l-4 border-l-amber-400 bg-amber-50/50";
      case "template":
        return "border-l-4 border-l-indigo-400 bg-indigo-50/50 font-mono text-[13px]";
      default:
        return "";
    }
  };

  const getIcon = () => {
    switch (type) {
      case "do":
        return <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0 mt-0.5" />;
      case "dont":
        return <XCircle className="h-4 w-4 text-red-600 shrink-0 mt-0.5" />;
      case "stat":
        return <TrendingUp className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />;
      case "tip":
        return <Lightbulb className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />;
      default:
        return null;
    }
  };

  const icon = getIcon();

  return (
    <div className={`rounded-lg p-4 ${getBorderColor()}`}>
      <h4 className="font-semibold text-sm mb-2">{heading}</h4>
      <div className="space-y-1.5">
        {content.map((line, i) =>
          line === "" ? (
            <div key={i} className="h-2" />
          ) : (
            <div key={i} className="flex gap-2">
              {icon && type !== "template" && type !== "stat" && <span>{icon}</span>}
              {type === "stat" && <span className="text-blue-600 shrink-0">→</span>}
              {type === "list" && <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />}
              <p className="text-sm text-muted-foreground leading-relaxed">{line}</p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function CitationBlock({ citations }: { citations: ResearchCitation[] }) {
  return (
    <div className="mt-4 pt-4 border-t">
      <p className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
        <Quote className="h-3 w-3" />
        Research & Sources
      </p>
      <div className="space-y-2">
        {citations.map((cite, i) => (
          <div
            key={i}
            className="text-xs text-muted-foreground bg-gray-50 rounded-md p-2.5"
          >
            <span className="font-medium text-foreground">{cite.source}</span>
            <span className="mx-1">—</span>
            <span>{cite.finding}</span>
            {cite.url && (
              <a
                href={cite.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 ml-1 text-blue-600 hover:underline"
              >
                View <ExternalLink className="h-2.5 w-2.5" />
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function TopicCard({ topic }: { topic: TopicItem }) {
  const config = categoryConfig[topic.category];
  const Icon = topic.icon;

  return (
    <AccordionItem value={topic.id} className="border rounded-lg mb-3 overflow-hidden">
      <AccordionTrigger className="px-5 py-4 hover:no-underline hover:bg-muted/50 [&[data-state=open]]:bg-muted/30">
        <div className="flex items-start gap-4 text-left w-full pr-4">
          <div className={`rounded-lg p-2 ${config.bgColor} shrink-0`}>
            <Icon className={`h-5 w-5 ${config.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="font-semibold text-sm">{topic.title}</h3>
              <Badge
                variant="outline"
                className={`text-[10px] ${config.color} ${config.bgColor}`}
              >
                {config.label}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground line-clamp-1">
              {topic.summary}
            </p>
          </div>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-5 pb-5">
        <div className="space-y-3 pt-2">
          {topic.sections.map((section, i) => (
            <SectionBlock
              key={i}
              heading={section.heading}
              content={section.content}
              type={section.type}
            />
          ))}
          {topic.citations && topic.citations.length > 0 && (
            <CitationBlock citations={topic.citations} />
          )}
        </div>
      </AccordionContent>
    </AccordionItem>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function CustomerServicePage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<TopicCategory | "all">("all");

  const filteredTopics = useMemo(() => {
    return topics.filter((topic) => {
      const matchesFilter =
        activeFilter === "all" || topic.category === activeFilter;
      const matchesSearch =
        !searchQuery ||
        topic.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        topic.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        topic.tags.some((tag) =>
          tag.toLowerCase().includes(searchQuery.toLowerCase())
        );
      return matchesFilter && matchesSearch;
    });
  }, [searchQuery, activeFilter]);

  const categoryFilters: { value: TopicCategory | "all"; label: string; count: number }[] = [
    { value: "all", label: "All Topics", count: topics.length },
    ...Object.entries(categoryConfig).map(([key, config]) => ({
      value: key as TopicCategory,
      label: config.label,
      count: topics.filter((t) => t.category === key).length,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Customer Service Guide</h1>
        <p className="text-muted-foreground mt-1">
          Research-backed best practices for responding to reviews and recovering
          customer trust.
        </p>
      </div>

      {/* VERA Quick Summary */}
      <Card className="border-purple-200 bg-gradient-to-r from-purple-50 to-white">
        <CardContent className="py-5">
          <div className="flex items-center gap-2 mb-3">
            <ShieldCheck className="h-5 w-5 text-purple-600" />
            <h2 className="font-bold text-sm text-purple-900">
              The VERA Framework — Your Review Response Playbook
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              {
                letter: "V",
                word: "Validate",
                desc: "Acknowledge the specific issue",
              },
              {
                letter: "E",
                word: "Empathise",
                desc: "Apologise without qualification",
              },
              {
                letter: "R",
                word: "Resolve",
                desc: "Offer clear recovery action",
              },
              {
                letter: "A",
                word: "Assure",
                desc: "Explain what you're changing",
              },
            ].map((step) => (
              <div
                key={step.letter}
                className="flex items-start gap-3 bg-white rounded-lg p-3 border border-purple-100"
              >
                <span className="text-2xl font-black text-purple-600">
                  {step.letter}
                </span>
                <div>
                  <p className="font-semibold text-sm">{step.word}</p>
                  <p className="text-xs text-muted-foreground">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Search & Filters */}
      <Card>
        <CardContent className="py-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search topics (e.g. VERA, recovery, templates, mirroring...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {categoryFilters.map((filter) => (
              <Button
                key={filter.value}
                variant={activeFilter === filter.value ? "default" : "outline"}
                size="sm"
                className="text-xs h-8"
                onClick={() => setActiveFilter(filter.value)}
              >
                {filter.label}
                <Badge
                  variant="secondary"
                  className="ml-1.5 text-[10px] px-1.5 py-0"
                >
                  {filter.count}
                </Badge>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Topics */}
      {filteredTopics.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No topics match your search. Try different keywords.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-0">
          {filteredTopics.map((topic) => (
            <TopicCard key={topic.id} topic={topic} />
          ))}
        </Accordion>
      )}

      {/* Footer attribution */}
      <Card className="bg-muted/30">
        <CardContent className="py-4">
          <p className="text-xs text-muted-foreground text-center">
            Content informed by research from Harvard Business School, Cornell
            Hospitality Quarterly, Journal of Service Research, BrightLocal, and
            Google/Ipsos studies. For educational purposes — adapt advice to your
            specific business context.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
