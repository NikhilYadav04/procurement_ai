//DASHBOARD PAGE - AI SOURCING PLATFORM (AUTHENTICATED)
//CHAT AREA IN THIS FILE
//CHAT BAR IN CHAT COMPOSER COMPONENT

import React, { useState, useEffect, useRef } from "react";
import Head from "next/head";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useRouter } from "next/router";
import {
  Check,
  CreditCard,
  Loader2,
  Wrench,
  CheckCircle,
  XCircle,
  ChevronDown,
  BarChart3,
  History,
  Clock,
  MessageSquare,
  X,
  ArrowRight,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import SideNav from "../components/SideNav";
import { Button } from "../components/ui/button";
import { Backdrop } from "../components/ui/atmosphere";
import ChatComposer from "../components/ChatComposer";
import { createCheckout, VARIANT_IDS } from "@/lib/lemonsqueezy";
import { SplitScreenLayout } from "../components/SplitScreenLayout";
import { QuoteComparison } from "../components/QuoteComparison";
import { MsmeRadar } from "../components/MsmeRadar";
import { ApprovalCard } from "../components/ApprovalCard";
import { LiveAuctionFeed } from "../components/LiveAuctionFeed";
import { AnimatePresence as FramerAnimatePresence } from "framer-motion";
import { supabase } from "../lib/supabase";
import { spring, enterItem } from "@/lib/motion";
import { formatINR, formatINRCompact, formatNumber, formatDateTime } from "@/lib/format";
import { useSpotlight } from "@/components/ui/atmosphere";

type QuickActionId = "rfp" | "auction" | "quotes";

// Today's briefing: the live facts that double as entry points. Replaces the
// old three-equal-cards quick action grid, which had no information in it.
interface BriefingFact {
  key: string;
  label: string;
  value: string;
  detail?: string;
  tone: "default" | "watch" | "breach" | "safe";
  onClick: () => void;
}

const BRIEFING_TONE_TEXT: Record<BriefingFact["tone"], string> = {
  default: "text-foreground",
  watch: "text-watch",
  breach: "text-breach",
  safe: "text-safe",
};

const BriefingRow: React.FC<{
  fact: BriefingFact;
  index: number;
  large?: boolean;
  className?: string;
}> = ({ fact, index, large, className }) => {
  const entry = enterItem(index);
  const spot = useSpotlight<HTMLButtonElement>();
  return (
  <motion.button
    ref={spot.ref}
    onPointerMove={spot.onPointerMove}
    initial={entry.initial}
    animate={entry.animate}
    transition={{ ...entry.transition, scale: spring.ui }}
    type="button"
    onClick={fact.onClick}
    whileTap={{ scale: 0.985 }}
    className={`panel-interactive spotlight group flex w-full min-w-0 items-center gap-3 rounded-[var(--radius)] border border-border/60 bg-surface/60 p-3.5 text-left backdrop-blur-sm transition-[border-color,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:p-4 ${className ?? ""}`}
  >
    <div className="min-w-0 flex-1">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {fact.label}
      </p>
      <p
        className={`figure mt-1 truncate font-semibold tabular-nums ${
          large ? "text-xl md:text-2xl" : "text-lg"
        } ${BRIEFING_TONE_TEXT[fact.tone]}`}
      >
        {fact.value}
      </p>
      {fact.detail && (
        <p className="mt-1 truncate text-xs text-muted-foreground">{fact.detail}</p>
      )}
    </div>
    <ArrowRight
      className="h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5"
      aria-hidden="true"
    />
  </motion.button>
  );
};

// User session interface
interface UserSession {
  user: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  };
  expiresAt: number;
}

// Customer data interface
interface CustomerData {
  plan_name: string;
  total_chat_credit: number;
  total_doc_credit: number;
  subscription_status: string;
}

// Chat message interfaces
interface ToolCall {
  name: string;
  args: any;
  id?: string;
  status?: "calling" | "success" | "error";
  result?: any;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: ToolCall[];
  timestamp: number;
}

// Helper function to get time-based greeting
const getTimeBasedGreeting = (): string => {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return "Good Morning";
  else if (hour >= 12 && hour < 17) return "Good Afternoon";
  else if (hour >= 17 && hour < 21) return "Good Evening";
  else return "Good Evening";
};

// Helper function to format tool names for display
/** Sentence case, with the acronyms this domain actually uses left alone.
 *  Title-casing every word produced "Generate Rfp" and "Read Msme Status". */
const TOOL_ACRONYMS: Record<string, string> = {
  rfp: 'RFP', rfq: 'RFQ', po: 'PO', msme: 'MSME', gstin: 'GSTIN', gst: 'GST', pdf: 'PDF',
};

const formatToolName = (toolName: string): string => {
  const words = toolName.split('_').filter(Boolean);
  return words
    .map((w, i) => {
      const acronym = TOOL_ACRONYMS[w.toLowerCase()];
      if (acronym) return acronym;
      return i === 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase();
    })
    .join(' ');
};

const STEP_LABELS: Record<string, string> = {
  create_rfp: "Drafting the RFP document",
  send_email: "Sending email",
  check_quotes: "Reading the inbox for vendor quotes",
  add_vendor: "Verifying and adding the vendor",
  add_vendors_bulk: "Adding vendors",
  list_vendors: "Looking up your vendors",
  delete_vendor: "Removing the vendor",
  schedule_auction: "Scheduling the reverse auction",
  create_auction: "Scheduling the reverse auction",
  view_auctions: "Looking up auctions",
  check_live_auction: "Checking the live auction",
  generate_executive_report: "Building the executive report",
  draft_negotiation: "Writing a counter-offer",
  list_negotiations: "Looking up negotiations",
  check_msme_compliance: "Checking MSME payment deadlines",
  record_invoice: "Updating the payment record",
  set_company_profile: "Saving your company details",
  get_company_profile: "Reading your company details",
};

const stepLabel = (toolName: string): string =>
  STEP_LABELS[toolName] || formatToolName(toolName);

const stepOutcome = (toolName: string, result: any): string | null => {
  if (!result || typeof result !== "object") return null;
  if (result.success === false) return result.error ? String(result.error).slice(0, 90) : "failed";

  switch (toolName) {
    case "check_quotes": {
      const found = result.sync?.new_quotes;
      const total = result.count ?? 0;
      if (total === 0) return "no quotes yet";
      return found ? `${found} new, ${total} total` : `${total} quote${total > 1 ? "s" : ""}`;
    }
    case "create_rfp":
      return result.rfp_number || null;
    case "add_vendor":
      return result.gstin_verified ? "GSTIN verified" : null;
    case "draft_negotiation":
      return result.asking_for ? `asking ${result.asking_for}` : null;
    case "check_msme_compliance":
      return result.amount_at_risk && result.amount_at_risk !== "₹0"
        ? `${result.amount_at_risk} at risk`
        : "nothing at risk";
    case "record_invoice":
      return result.days_left !== null && result.days_left !== undefined
        ? `${result.days_left} days left`
        : result.action || null;
    case "list_vendors":
      return typeof result.count === "number" ? `${result.count} vendors` : null;
    default:
      return null;
  }
};

// Helper function to generate contextual suggestions based on tool invocation
const getToolSuggestions = (toolName: string): string[] => {
  switch (toolName) {
    case 'create_rfp':
      return [
        'Send this RFP to vendors via email',
        'Schedule a live auction for this RFP'
      ];
    case 'send_email':
      return [
        'Schedule a follow-up auction',
        'Generate an executive report'
      ];
    case 'schedule_auction':
    case 'create_auction':
      return [
        'Invite vendors to this auction',
        'Monitor live auction bids',
        'Send auction details to vendors'
      ];
    case 'generate_executive_report':
      return [
        'Send this report to my manager',
        'Email report to stakeholders',
        'Generate another report for different date'
      ];
    case 'add_vendor':
      return [
        'Send RFP to this vendor',
        'Invite vendor to upcoming auction'
      ];
    default:
      return [];
  }
};

// "Closes in 2h 15m" style countdown for the briefing's auction fact.
const formatAuctionCountdown = (endsAt: string): string => {
  const diffMs = new Date(endsAt).getTime() - Date.now();
  if (diffMs <= 0) return "Closing now";
  const totalMinutes = Math.floor(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `Closes in ${days}d ${hours}h`;
  if (hours > 0) return `Closes in ${hours}h ${minutes}m`;
  return `Closes in ${minutes}m`;
};

const Index: React.FC = () => {
  const router = useRouter();
  const prefersReducedMotion = useReducedMotion();

  // User and authentication state
  const [user, setUser] = useState<UserSession["user"] | null>(null);

  // Query and result states
  const [query, setQuery] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<any[]>([]);

  // Chat states
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [threadId, setThreadId] = useState<string>(`thread-${Date.now()}`);
  const [streamingContent, setStreamingContent] = useState<string>("");
  const [fullContentBuffer, setFullContentBuffer] = useState<string>("");
  const [isTyping, setIsTyping] = useState<boolean>(false);
  // Live agent run trace: one row per tool call, in flight or settled.
  const [liveToolCalls, setLiveToolCalls] = useState<ToolCall[]>([]);
  const [expandedToolIds, setExpandedToolIds] = useState<Set<string>>(new Set());
  const [chatSessions, setChatSessions] = useState<
    Array<{
      id: string;
      title: string;
      timestamp: number;
      messages: ChatMessage[];
    }>
  >([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // UI states
  const [greeting, setGreeting] = useState<string>(getTimeBasedGreeting());
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState("plus");
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [showChatHistory, setShowChatHistory] = useState(false);

  // The payment clock is pinned over the conversation, so it has to be
  // dismissible: at xl it otherwise sits on top of the thread's right edge.
  // Remembered between sessions, because re-hiding it every visit is worse
  // than never having pinned it.
  const [clockHidden, setClockHidden] = useState(false);

  useEffect(() => {
    try {
      setClockHidden(window.localStorage.getItem('procurix.clockHidden') === '1');
    } catch {
      /* private mode: it simply stays open */
    }
  }, []);

  const toggleClock = () => {
    setClockHidden((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem('procurix.clockHidden', next ? '1' : '0');
      } catch {
        /* nothing to persist to */
      }
      return next;
    });
  };
  const [hasStartedChat, setHasStartedChat] = useState(false);
  const [injectedPrompt, setInjectedPrompt] = useState<string>("");

  // Split-screen live auction states
  const [splitScreenActive, setSplitScreenActive] = useState(false);
  const [liveAuctionId, setLiveAuctionId] = useState<string | null>(null);
  const [comparisonRfp, setComparisonRfp] = useState<string | null>(null);
  const pendingComparisonRef = useRef<string | null>(null);
  const [msmeRefreshKey, setMsmeRefreshKey] = useState(0);

  // Today's briefing: quotes waiting, money at risk under 43B(h), auction closing next
  const [briefing, setBriefing] = useState<{
    quotesWaiting: number;
    quotesRfpNumber: string | null;
    amountAtRisk: number;
    breached: number;
    urgent: number;
    nextAuction: { id: string; title: string; endsAt: string } | null;
    savedTotal: number;
    savedCount: number;
  } | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(true);

  // Customer data and credits
  const [customerData, setCustomerData] = useState<CustomerData | null>(null);
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [chatCredits, setChatCredits] = useState({
    total: 0,
    isUnlimited: false,
  });
  const [documentCredits, setDocumentCredits] = useState({
    total: 0,
    isUnlimited: false,
  });

  // Subscription plans
  const subscriptionPlans = [
    {
      id: "topup",
      name: "TopUp",
      price: 5,
      period: "one-time",
      features: ["200 sourcing queries", "50 RFP generations"],
      description: "200 queries & 50 RFPs",
      cta: "Purchase TopUp",
    },
    {
      id: "plus",
      name: "Plus",
      price: 20,
      period: "/month",
      features: [
        "Unlimited sourcing queries",
        "Unlimited RFP generation",
        "Priority supplier matching",
      ],
      description: "Unlimited everything",
      cta: "Upgrade Now",
    },
  ];

  // Load user session and fetch customer data
  useEffect(() => {
    const loadUserSession = () => {
      try {
        const cookies = document.cookie.split(";");
        const sessionCookie = cookies.find((c) =>
          c.trim().startsWith("session=")
        );

        if (!sessionCookie) {
          router.push("/login");
          return;
        }

        const sessionValue = sessionCookie.split("=")[1];
        const sessionData = JSON.parse(
          decodeURIComponent(sessionValue)
        ) as UserSession;

        if (sessionData.expiresAt <= Date.now()) {
          router.push("/login");
          return;
        }

        setUser(sessionData.user);
        fetchCustomerData(sessionData.user.email);
        
        // Try to restore chat from localStorage if available
        const savedCurrentChat = localStorage.getItem('currentChat');
        if (savedCurrentChat && chatMessages.length === 0) {
          try {
            const parsed = JSON.parse(savedCurrentChat);
            if (parsed.messages && parsed.messages.length > 0) {
              setChatMessages(parsed.messages);
              setThreadId(parsed.threadId || `thread-${Date.now()}`);
              setHasStartedChat(true);
            }
          } catch (e) {
            console.error('Error restoring chat:', e);
          }
        }
      } catch (error) {
        console.error("Error loading user session:", error);
        router.push("/login");
      }
    };

    loadUserSession();
  }, [router]);

  // Check if user needs to complete onboarding by verifying profile in database
  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const cookies = document.cookie.split(";");
        const sessionCookie = cookies.find((c) =>
          c.trim().startsWith("session=")
        );
        
        if (sessionCookie) {
          const sessionValue = sessionCookie.split("=")[1];
          const sessionData = JSON.parse(decodeURIComponent(sessionValue));
          const userEmail = sessionData.user?.email;

          if (userEmail) {
            // Check if user profile is complete
            const response = await fetch(`/api/user/update-profile?email=${encodeURIComponent(userEmail)}`);
            if (response.ok) {
              const result = await response.json();
              // If user doesn't have role and industry, redirect to welcome
              if (!result.data?.role || !result.data?.industry) {
                console.log('Onboarding incomplete, redirecting to welcome page');
                router.push("/welcome");
              }
            }
          }
        }
      } catch (error) {
        console.error('Error checking onboarding:', error);
        // Don't redirect on error to avoid blocking user
      }
    };

    checkOnboarding();
  }, [router]);

  // Update greeting periodically
  useEffect(() => {
    setGreeting(getTimeBasedGreeting());

    const interval = setInterval(() => {
      setGreeting(getTimeBasedGreeting());
    }, 60000);

    return () => clearInterval(interval);
  }, []);

  // Fetch the facts for today's briefing: quotes waiting, money at risk under
  // 43B(h), and the auction closing soonest. Re-fetched whenever a tool call
  // touches compliance, quotes, or auctions (msmeRefreshKey).
  const fetchBriefing = async (email: string, userId?: string) => {
    try {
      setBriefingLoading(true);

      const [complianceRes, briefingRes, auctionsRes] = await Promise.all([
        fetch(`/api/compliance/summary?customerEmail=${encodeURIComponent(email)}`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        fetch("/api/dashboard/briefing")
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null),
        supabase
          .from("auctions")
          .select("id, title, status, scheduled_end")
          .or(`created_by.eq.${email},created_by.eq.${userId || ""}`),
      ]);

      const savedTotal = briefingRes?.savedTotal || 0;
      const savedCount = briefingRes?.savedCount || 0;
      const quotesWaiting = briefingRes?.quotesWaiting || 0;
      const quotesRfpNumber = briefingRes?.quotesRfpNumber || null;

      const now = Date.now();
      const openAuctions = (auctionsRes.data || [])
        .filter(
          (a: any) =>
            a.status !== "completed" &&
            a.status !== "cancelled" &&
            new Date(a.scheduled_end).getTime() > now
        )
        .sort(
          (a: any, b: any) =>
            new Date(a.scheduled_end).getTime() - new Date(b.scheduled_end).getTime()
        );
      const nextAuction = openAuctions[0]
        ? {
            id: openAuctions[0].id,
            title: openAuctions[0].title,
            endsAt: openAuctions[0].scheduled_end,
          }
        : null;

      setBriefing({
        quotesWaiting,
        quotesRfpNumber,
        amountAtRisk: complianceRes?.amount_at_risk || 0,
        breached: complianceRes?.breached || 0,
        urgent: complianceRes?.urgent || 0,
        nextAuction,
        savedTotal,
        savedCount,
      });
    } catch (error) {
      console.error("Error fetching briefing:", error);
      setBriefing(null);
    } finally {
      setBriefingLoading(false);
    }
  };

  useEffect(() => {
    if (user?.email) {
      fetchBriefing(user.email, user.id);
    }
  }, [user?.email, user?.id, msmeRefreshKey]);

  // Fetch customer data from database
  const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

  const fetchCustomerData = async (email: string) => {
    if (DEMO_MODE) {
      setCustomerData({
        plan_name: "plus",
        total_chat_credit: -1,
        total_doc_credit: -1,
        subscription_status: "active",
      });
      setChatCredits({ total: 0, isUnlimited: true });
      setDocumentCredits({ total: 0, isUnlimited: true });
      setCreditsLoading(false);
      return;
    }

    try {
      setCreditsLoading(true);

      const response = await fetch(
        `/api/customer/${encodeURIComponent(email)}`
      );
      const result = await response.json();

      if (result.success && result.data) {
        setCustomerData(result.data);

        const chatTotal = result.data.total_chat_credit;
        const docTotal = result.data.total_doc_credit;

        setChatCredits({
          total: chatTotal === -1 ? 0 : chatTotal,
          isUnlimited: chatTotal === -1,
        });

        setDocumentCredits({
          total: docTotal === -1 ? 0 : docTotal,
          isUnlimited: docTotal === -1,
        });
      } else {
        // Free tier defaults
        setCustomerData({
          plan_name: "free",
          total_chat_credit: 50,
          total_doc_credit: 10,
          subscription_status: "active",
        });
        setChatCredits({ total: 50, isUnlimited: false });
        setDocumentCredits({ total: 10, isUnlimited: false });
      }
    } catch (error) {
      console.error("Error fetching customer data:", error);
      setChatCredits({ total: 50, isUnlimited: false });
      setDocumentCredits({ total: 10, isUnlimited: false });
    } finally {
      setCreditsLoading(false);
    }
  };

  // Handle subscription checkout - open in new tab and refresh
  const handleSubscriptionCheckout = async (planId: string) => {
    const variantId = planId === "topup" ? VARIANT_IDS.TOPUP : VARIANT_IDS.PLUS;

    if (!variantId) {
      toast.error(
        "Payment system is not configured yet. Please check back later or contact support."
      );
      return;
    }

    setCheckoutLoading(true);

    try {
      const result = await createCheckout({
        variantId,
        email: user?.email,
        name: user?.name,
        customData: {
          plan: planId === "topup" ? "topup" : "plus",
          source: "home",
          userId: user?.id,
        },
      });

      if (!result.success || !result.checkoutUrl) {
        throw new Error(result.error || "Failed to create checkout session");
      }

      // Open payment page in new tab
      window.open(result.checkoutUrl, "_blank");

      // Close modal
      setShowUpgradeModal(false);

      // Refresh current page after short delay
      setTimeout(() => {
        router.push("/dashboard");
      }, 1000);
    } catch (error: any) {
      console.error("Checkout error:", error);
      toast.error(
        error.message ||
          "Failed to open checkout. Please try again or contact support."
      );
    } finally {
      setCheckoutLoading(false);
    }
  };

  // Handle logout
  const handleLogout = () => {
    document.cookie =
      "session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
    router.push("/login");
  };

  // Handle quick action button clicks
  const handleQuickAction = (actionType: QuickActionId) => {
    const prompts: Record<QuickActionId, string> = {
      rfp: "Please prepare an RFP for the procurement of 1,000 Arduino boards, to be delivered to Sector 16, Noida, by Feb 24 2026, for a total budget of ₹30,000",
      auction: "Please assist in creating a live auction for 2,000 laptops, with the auction and delivery completed by 15th March, with a budget of ₹15,00,000",
      quotes: "Check my inbox for new vendor quotes and show me how they compare",
    };
    
    setInjectedPrompt(prompts[actionType]);
    // Scroll to composer
    setTimeout(() => {
      const composer = document.querySelector('[data-chat-composer]');
      if (composer) {
        composer.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  // Turn the fetched briefing into ordered, clickable facts. The most severe
  // fact leads; ties keep the spec's order (quotes, compliance, auction).
  // Expand or collapse a settled tool call's detail in the agent run trace.
  const toggleToolExpanded = (id?: string) => {
    if (!id) return;
    setExpandedToolIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  /** Suggested actions. Rendered above the composer in both the empty state
   *  and mid-conversation, because they are the next things you can do and
   *  they were disappearing the moment a chat started. */
  const renderSuggestedActions = (compact: boolean) => {
    if (briefingLoading || !briefing) return null;
    const facts = buildBriefingFacts();
    if (facts.length === 0) return null;
    if (compact) {
      return (
        <div className="flex flex-wrap items-center gap-2">
          {facts.map((fact) => (
            <button
              key={fact.key}
              type="button"
              onClick={fact.onClick}
              className="group inline-flex items-center gap-2 rounded-[var(--radius-inner)] border border-border/60 bg-surface/60 px-3 py-1.5 text-xs backdrop-blur-sm transition-colors duration-150 hover:border-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="text-muted-foreground">{fact.label}</span>
              <span className={`figure font-semibold ${BRIEFING_TONE_TEXT[fact.tone]}`}>{fact.value}</span>
            </button>
          ))}
        </div>
      );
    }
    return null;
  };

  const buildBriefingFacts = (): BriefingFact[] => {
    if (!briefing) return [];

    const quotesFact: BriefingFact = {
      key: "quotes",
      label: "Quotes waiting on you",
      value:
        briefing.quotesWaiting > 0
          ? `${formatNumber(briefing.quotesWaiting)} quote${briefing.quotesWaiting > 1 ? "s" : ""}`
          : "None waiting",
      detail: briefing.quotesRfpNumber ? `On ${briefing.quotesRfpNumber}` : undefined,
      tone: "default",
      onClick: () => {
        if (briefing.quotesRfpNumber) {
          setComparisonRfp(briefing.quotesRfpNumber);
        } else {
          handleQuickAction("quotes");
        }
      },
    };

    const moneyTone: BriefingFact["tone"] =
      briefing.breached > 0 ? "breach" : briefing.urgent > 0 ? "watch" : "safe";
    const moneyFact: BriefingFact = {
      key: "compliance",
      label: "At risk under 43B(h)",
      value: formatINR(briefing.amountAtRisk),
      detail:
        briefing.breached > 0
          ? `${briefing.breached} order${briefing.breached > 1 ? "s" : ""} past their deadline`
          : briefing.urgent > 0
          ? `${briefing.urgent} order${briefing.urgent > 1 ? "s" : ""} due soon`
          : "Nothing overdue",
      tone: moneyTone,
      onClick: () => {
        document
          .getElementById("compliance-radar")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      },
    };

    const savedFact: BriefingFact = {
      key: "saved",
      label: "Won against the highest quote",
      value: briefing.savedTotal > 0 ? formatINR(briefing.savedTotal) : "No awards yet",
      detail:
        briefing.savedCount > 0
          ? `Across ${formatNumber(briefing.savedCount)} awarded order${
              briefing.savedCount > 1 ? "s" : ""
            }`
          : "Award a quote and the saving is recorded here",
      tone: briefing.savedTotal > 0 ? "safe" : "default",
      onClick: () => handleQuickAction("quotes"),
    };

    const auctionFact: BriefingFact = {
      key: "auction",
      label: "Auction closing next",
      value: briefing.nextAuction ? formatAuctionCountdown(briefing.nextAuction.endsAt) : "None scheduled",
      detail: briefing.nextAuction?.title,
      tone: "default",
      onClick: () => {
        if (briefing.nextAuction) {
          router.push(`/auction/${briefing.nextAuction.id}/client`);
        } else {
          handleQuickAction("auction");
        }
      },
    };

    const facts = [quotesFact, moneyFact, auctionFact, savedFact];
    const severity = (fact: BriefingFact): number => {
      if (fact.key === "compliance") return briefing.breached > 0 ? 2 : briefing.urgent > 0 ? 1 : 0;
      if (fact.key === "quotes") return briefing.quotesWaiting > 0 ? 1 : 0;
      if (fact.key === "saved") return -1;
      return 0;
    };
    return [...facts].sort((a, b) => severity(b) - severity(a));
  };

  // Auto-scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages, streamingContent, liveToolCalls]);

  // Typewriter effect for streaming content
  useEffect(() => {
    if (!fullContentBuffer) {
      setStreamingContent("");
      setIsTyping(false);
      return;
    }

    setIsTyping(true);
    let currentIndex = 0;
    const intervalId = setInterval(() => {
      if (currentIndex < fullContentBuffer.length) {
        setStreamingContent(fullContentBuffer.slice(0, currentIndex + 1));
        currentIndex += 3; // 3 characters at a time for faster typing
      } else {
        setStreamingContent(fullContentBuffer);
        setIsTyping(false);
        clearInterval(intervalId);
      }
    }, 20); // 20ms interval for smooth typing

    return () => {
      clearInterval(intervalId);
      setIsTyping(false);
    };
  }, [fullContentBuffer]);

  // Load chat sessions from localStorage
  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("wipe")) {
      localStorage.removeItem("chatSessions");
      localStorage.removeItem("currentChat");
      window.location.replace("/dashboard");
      return;
    }
    const saved = localStorage.getItem("chatSessions");
    if (saved) {
      try {
        setChatSessions(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load chat sessions:", e);
      }
    }
  }, []);

  // Listen for new chat event from sidebar
  useEffect(() => {
    const handleNewChatEvent = () => {
      handleNewChat();
    };
    window.addEventListener("newChat", handleNewChatEvent);
    return () => window.removeEventListener("newChat", handleNewChatEvent);
  }, [chatMessages, threadId]);

  // Handle sourcing query with agent integration
  const uploadAttachments = async (files: File[]): Promise<string> => {
    const summaries: string[] = [];

    for (const file of files) {
      try {
        const form = new FormData();
        form.append("file", file);

        const res = await fetch("/api/quotes/upload", { method: "POST", body: form });
        const data = await res.json();

        if (data.success && data.quote_saved) {
          summaries.push(
            `[Attached "${file.name}" was read as a quote from ${data.vendor_name} for ${formatINR(Number(data.total_amount))}${data.delivery_days ? `, delivery ${data.delivery_days} days` : ""}. It has been saved${data.rfp_number ? ` against ${data.rfp_number}` : ""}.]`
          );
        } else if (data.success && data.extracted_text) {
          summaries.push(`[Attached "${file.name}" contains:\n${data.extracted_text}]`);
        } else {
          summaries.push(`[Attached "${file.name}" could not be read: ${data.error || "unknown reason"}]`);
        }
      } catch (err: any) {
        summaries.push(`[Attached "${file.name}" failed to upload: ${err.message}]`);
      }
    }

    return summaries.join("\n");
  };

  const handleSearch = async (searchQuery: string, files?: File[]) => {
    const attachedDocs = files || [];

    if (!searchQuery.trim() && attachedDocs.length === 0) return;

    if (attachedDocs.length > 0) {
      const uploadNote = await uploadAttachments(attachedDocs);
      searchQuery = searchQuery.trim()
        ? `${searchQuery}\n\n${uploadNote}`
        : uploadNote;
    }

    if (!searchQuery.trim()) return;

    // Set chat started flag on first message
    if (chatMessages.length === 0) {
      setHasStartedChat(true);
    }
    
    // Save current chat to localStorage for persistence
    const currentChatData = {
      threadId,
      messages: [...chatMessages, {
        id: `msg-${Date.now()}`,
        role: "user" as const,
        content: searchQuery,
        timestamp: Date.now(),
      }],
    };
    localStorage.setItem('currentChat', JSON.stringify(currentChatData));

    // Check if user has credits
    if (!DEMO_MODE && !chatCredits.isUnlimited && chatCredits.total <= 0) {
      setShowUpgradeModal(true);
      toast.error("No credits remaining", {
        description: "Please upgrade to continue sourcing.",
      });
      return;
    }

    setQuery(searchQuery);
    setIsProcessing(true);
    setStreamingContent("");
    setFullContentBuffer(""); // Clear buffer from previous responses
    setLiveToolCalls([]);
    setIsTyping(false); // Reset typing state
    setSuggestions([]); // Clear previous suggestions

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: "user",
      content: searchQuery,
      timestamp: Date.now(),
    };
    setChatMessages((prev) => [...prev, userMessage]);

    try {
      // Build messages array for agent - identity comes from the session server-side
      const allMessages = [...chatMessages, userMessage].map((msg) => ({
        role: msg.role,
        content: msg.content,
      }));

      // Call agent API with streaming
      console.log("[FRONTEND] Sending to API:", {
        messageCount: allMessages.length,
        threadId,
        chatSessionsCount: chatSessions.length,
      });

      pendingComparisonRef.current = null;

      const response = await fetch("/api/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: allMessages,
          threadId,
          userId: user?.id,
          customerEmail: user?.email,
          chatSessions: chatSessions, // Pass all chat sessions for report generation
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to connect to agent");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      let assistantContent = "";
      let assistantToolCalls: ToolCall[] = [];
      let toolCallMap = new Map<string, number>();
      let buffer = ""; // Buffer for incomplete JSON chunks

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          buffer += chunk; // Accumulate chunks
          const lines = buffer.split("\n");
          
          // Keep the last line in buffer if it's incomplete
          buffer = lines.pop() || "";

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const jsonStr = line.slice(6);
                // Skip empty data lines
                if (!jsonStr.trim()) continue;
                
                const data = JSON.parse(jsonStr);

                if (data.type === "token") {
                  // Streaming individual tokens from LLM
                  assistantContent += data.token;
                  setFullContentBuffer(assistantContent);
                } else if (data.type === "content") {
                  // Full content update (fallback for non-streaming models)
                  // Handle chunked content
                  if (data.isChunk) {
                    assistantContent += data.content;
                  } else {
                    assistantContent = data.content;
                  }
                  setFullContentBuffer(assistantContent);
                } else if (data.type === "tool_call_start") {
                  // Tool execution starting
                  const toolCall: ToolCall = {
                    name: data.toolName,
                    args: data.args,
                    id: data.id,
                    status: "calling",
                  };

                  assistantToolCalls.push(toolCall);
                  toolCallMap.set(data.id, assistantToolCalls.length - 1);

                  setLiveToolCalls((prev) => [...prev, toolCall]);
                } else if (data.type === "tool_call_end") {
                  // Tool execution completed
                  const toolIndex = toolCallMap.get(data.toolCallId);
                  if (toolIndex !== undefined) {
                    // Check if the tool result has a success field
                    const hasSuccessField =
                      data.result &&
                      typeof data.result === "object" &&
                      "success" in data.result;
                    const isSuccess = hasSuccessField
                      ? data.result.success
                      : true;

                    assistantToolCalls[toolIndex].status = isSuccess
                      ? "success"
                      : "error";
                    assistantToolCalls[toolIndex].result = data.result;

                    if (
                      data.toolName === "check_quotes" &&
                      isSuccess &&
                      data.result?.count > 0 &&
                      data.result?.quotes?.[0]?.rfp
                    ) {
                      pendingComparisonRef.current = data.result.quotes[0].rfp;
                    }

                    if (
                      isSuccess &&
                      ["record_invoice", "check_msme_compliance", "add_vendor"].includes(data.toolName)
                    ) {
                      setMsmeRefreshKey((k) => k + 1);
                    }

                    // Collapse the matching trace row into its one-line receipt
                    setLiveToolCalls((prev) =>
                      prev.map((call) =>
                        call.id === data.toolCallId
                          ? { ...call, status: isSuccess ? "success" : "error", result: data.result }
                          : call
                      )
                    );

                    // Generate contextual suggestions if tool succeeded
                    if (isSuccess) {
                      const toolSuggestions = getToolSuggestions(assistantToolCalls[toolIndex].name);
                      if (toolSuggestions.length > 0) {
                        setSuggestions(toolSuggestions);
                      }
                    }

                    // Check if this was an immediate-start auction creation
                    if (
                      isSuccess &&
                      assistantToolCalls[toolIndex].name === "schedule_auction" &&
                      data.result &&
                      typeof data.result === "object" &&
                      data.result.auction_id &&
                      data.result.is_immediate_start
                    ) {
                      // Activate split-screen mode for immediate-start auctions (desktop only)
                      setLiveAuctionId(data.result.auction_id);
                      const isMobile = window.innerWidth < 768;
                      if (!isMobile) {
                        setSplitScreenActive(true);
                        toast.success("Live auction started", {
                          description: "Switching to split-screen mode…",
                        });
                      } else {
                        toast.success("Live auction started", {
                          description: "View it in the Auctions page",
                        });
                      }
                    }
                  }
                } else if (data.type === "error") {
                  throw new Error(data.error);
                } else if (data.type === "done") {
                  // Stream complete
                  if (pendingComparisonRef.current) {
                    setComparisonRfp(pendingComparisonRef.current);
                    pendingComparisonRef.current = null;
                  }
                  break;
                }
              } catch (parseError) {
                console.error("Error parsing SSE data:", parseError);
                console.error("Problematic line:", line.substring(0, 200));
                // Continue processing other lines even if one fails
                continue;
              }
            }
          }
        }
      }

      // Wait a brief moment for typewriter effect to catch up
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Set processing to false immediately after streaming completes
      setIsProcessing(false);

      // Add complete assistant message
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: "assistant",
        content: assistantContent,
        toolCalls:
          assistantToolCalls.length > 0 ? assistantToolCalls : undefined,
        timestamp: Date.now(),
      };
      setChatMessages((prev) => {
        const updated = [...prev, assistantMessage];

        // Save to chat history
        const sessionTitle =
          chatMessages[0]?.content.slice(0, 50) || "New Chat";
        const session = {
          id: threadId,
          title: sessionTitle,
          timestamp: Date.now(),
          messages: updated,
        };

        const savedSessions = localStorage.getItem("chatSessions");
        let sessions = savedSessions ? JSON.parse(savedSessions) : [];
        const existingIdx = sessions.findIndex((s: any) => s.id === threadId);

        if (existingIdx >= 0) {
          sessions[existingIdx] = session;
        } else {
          sessions = [session, ...sessions].slice(0, 50); // Keep last 50 chats
        }

        localStorage.setItem("chatSessions", JSON.stringify(sessions));
        setChatSessions(sessions);
        
        // Also update current chat in localStorage for navigation persistence
        localStorage.setItem('currentChat', JSON.stringify({
          threadId,
          messages: updated,
        }));

        return updated;
      });
      setStreamingContent("");
      setFullContentBuffer("");
      setLiveToolCalls([]);
      setIsTyping(false);

      // Deduct credit
      if (user?.email && !DEMO_MODE) {
        const response = await fetch("/api/customer/deduct-credit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            email: user.email,
            type: "chat",
            amount: 1,
          }),
        });

        const result = await response.json();
        if (result.success && result.data && !result.data.is_unlimited) {
          setChatCredits({
            total: result.data.credits_remaining,
            isUnlimited: false,
          });
        }
      }

      toast.success("Response received");
    } catch (error) {
      console.error("Agent error:", error);
      toast.error("Failed to get response", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });

      // Remove streaming content on error
      setStreamingContent("");
      setFullContentBuffer("");
      setLiveToolCalls([]);
      setIsTyping(false);
      setIsProcessing(false);
    }
  };

  // Clear chat and start new conversation
  const handleNewChat = () => {
    // Save current session if it has messages
    if (chatMessages.length > 0) {
      const sessionTitle = chatMessages[0]?.content.slice(0, 50) || "New Chat";
      const session = {
        id: threadId,
        title: sessionTitle,
        timestamp: Date.now(),
        messages: chatMessages,
      };

      const savedSessions = localStorage.getItem("chatSessions");
      let sessions = savedSessions ? JSON.parse(savedSessions) : [];
      const existingIdx = sessions.findIndex((s: any) => s.id === threadId);

      if (existingIdx >= 0) {
        sessions[existingIdx] = session;
      } else {
        sessions = [session, ...sessions].slice(0, 50);
      }

      localStorage.setItem("chatSessions", JSON.stringify(sessions));
      setChatSessions(sessions);
    }
    
    // Clear current chat from localStorage
    localStorage.removeItem('currentChat');

    setChatMessages([]);
    setThreadId(`thread-${Date.now()}`);
    setStreamingContent("");
    setFullContentBuffer("");
    setIsTyping(false);
    setLiveToolCalls([]);
    setResults([]);
    setHasStartedChat(false);
    setSuggestions([]);
  };

  // Load a previous chat session
  const loadChatSession = (sessionId: string) => {
    const session = chatSessions.find((s) => s.id === sessionId);
    if (session) {
      setChatMessages(session.messages);
      setThreadId(session.id);
      setHasStartedChat(session.messages.length > 0);
    }
  };

  // Handle exit from split-screen mode
  const handleExitSplitScreen = () => {
    setSplitScreenActive(false);
    setLiveAuctionId(null);
  };

  return (
    <>
      <Head>
        <title>Procurix - AI Sourcing Platform</title>
        <meta
          name="description"
          content="Premium AI-powered sourcing and procurement"
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
      </Head>

      <div className="relative flex min-h-[100dvh] flex-col overflow-x-hidden bg-background">
        <Backdrop />
        {/* Side Navigation with Profile and Credits */}
        <SideNav
          activePage="home"
          user={user}
          customerData={customerData}
          chatCredits={chatCredits}
          documentCredits={documentCredits}
          creditsLoading={creditsLoading}
          onUpgrade={() => setShowUpgradeModal(true)}
          onLogout={handleLogout}
        />

        {/* Chat History Sidebar */}
        <AnimatePresence>
          {showChatHistory && (
            <>
              {/* Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowChatHistory(false)}
                className="fixed inset-0 bg-black/20 z-40 ml-0 md:ml-20"
              />

              {/* Sidebar Panel */}
              {/* Slides out from behind the nav rail, which sits above it at
                  z-60. Percentage rather than a fixed -320px so the mobile
                  full-width panel also starts fully off-screen. */}
              <motion.div
                initial={{ x: "-100%" }}
                animate={{ x: 0 }}
                exit={{ x: "-100%" }}
                transition={spring.surface}
                className="fixed left-0 md:left-20 top-0 h-full w-full md:w-80 border-r border-border bg-surface z-50 flex flex-col"
              >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border">
                  <div className="flex items-center gap-2">
                    <History className="h-5 w-5 text-primary" aria-hidden="true" />
                    <h2 className="text-lg font-semibold text-foreground">
                      Chat History
                    </h2>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowChatHistory(false)}
                    aria-label="Close chat history"
                  >
                    <X className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
                  </Button>
                </div>

                {/* Chat Sessions List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {chatSessions.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center px-4">
                      <MessageSquare className="mb-3 h-12 w-12 text-muted-foreground/40" aria-hidden="true" />
                      <p className="text-sm text-muted-foreground">
                        No chat history yet
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Start a conversation to see it here
                      </p>
                    </div>
                  ) : (
                    chatSessions.map((session) => {
                      const isActive = session.id === threadId;
                      const timeStr = formatDateTime(session.timestamp);

                      return (
                        <button
                          key={session.id}
                          onClick={() => {
                            loadChatSession(session.id);
                            setShowChatHistory(false);
                          }}
                          className={`w-full text-left p-3 rounded-lg transition-[background-color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            isActive
                              ? "bg-primary/10 border border-primary/35"
                              : "hover:bg-secondary border border-transparent"
                          }`}
                        >
                          <p
                            className={`text-sm font-medium mb-1 line-clamp-2 ${
                              isActive
                                ? "text-primary"
                                : "text-foreground"
                            }`}
                          >
                            {session.title}
                          </p>
                          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" aria-hidden="true" />
                            <span>{timeStr}</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <main
          className={`flex-1 flex px-3 md:px-6 transition-[padding] duration-500 ease-in-out ml-0 md:ml-20 ${
            hasStartedChat
              ? "items-start pt-4 md:pt-8 pb-40 md:pb-32"
              : "items-center justify-center pb-24 md:pb-12 pt-8 md:pt-12"
          }`}
        >
          <div className={`relative z-10 mx-auto w-full max-w-[1100px] 2xl:max-w-[1340px] ${clockHidden ? "" : "xl:pr-[360px]"}`}>
            {/* History Button - Show only when there are saved chats and not currently in a conversation */}
            {chatSessions.length > 0 && chatMessages.length === 0 && (
              <Button
                variant="outline"
                size="icon"
                onClick={() => setShowChatHistory(!showChatHistory)}
                className="panel fixed left-3 top-4 z-30 md:left-24 md:top-6"
                title="Chat History"
                aria-label="Open chat history"
              >
                <History className="h-5 w-5 text-primary" aria-hidden="true" />
              </Button>
            )}

            {/* Chat Messages Display */}
            {chatMessages.length > 0 && (
              <div className="w-full space-y-4 pb-44 pr-1 md:space-y-6 md:pb-32 md:pr-2">
                {chatMessages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{ contentVisibility: "auto" }}
                    className={`flex ${
                      message.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={
                        message.role === "user"
                          ? "max-w-[85%] md:max-w-[70%] rounded-2xl bg-primary px-4 py-3 text-primary-foreground md:px-6 md:py-4"
                          : "panel w-full max-w-full px-4 py-3 md:px-6 md:py-4"
                      }
                    >
                      {message.role === "user" ? (
                        <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed">
                          {message.content}
                        </p>
                      ) : (
                        <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed text-foreground">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ node, children, ...props }) => {
                                // Function to highlight numbers and percentages
                                const highlightNumbers = (text: any): any => {
                                  if (typeof text !== 'string') return text;
                                  
                                  const parts = text.split(/([0-9]+(?:[.,][0-9]+)?%?)/g);
                                  return parts.map((part, i) => {
                                    if (/^[0-9]+(?:[.,][0-9]+)?%?$/.test(part)) {
                                      return (
                                        <span key={i} className="font-semibold text-primary">
                                          {part}
                                        </span>
                                      );
                                    }
                                    return part;
                                  });
                                };
                                
                                const processChildren = (children: any): any => {
                                  if (typeof children === 'string') {
                                    return highlightNumbers(children);
                                  }
                                  if (Array.isArray(children)) {
                                    return children.map((child, i) => {
                                      if (typeof child === 'string') {
                                        return <span key={i}>{highlightNumbers(child)}</span>;
                                      }
                                      return child;
                                    });
                                  }
                                  return children;
                                };
                                
                                return (
                                  <p className="mb-3 last:mb-0 leading-relaxed" {...props}>
                                    {processChildren(children)}
                                  </p>
                                );
                              },
                              ul: ({ node, ...props }) => (
                                <ul
                                  className="mb-4 ml-5 space-y-2 [&>li::marker]:text-primary dark:[&>li::marker]:text-primary"
                                  style={{ listStyleType: 'disc' }}
                                  {...props}
                                />
                              ),
                              ol: ({ node, ...props }) => (
                                <ol
                                  className="mb-4 ml-5 space-y-2 [&>li::marker]:text-primary dark:[&>li::marker]:text-primary [&>li::marker]:font-semibold"
                                  style={{ listStyleType: 'decimal' }}
                                  {...props}
                                />
                              ),
                              li: ({ node, children, ...props }) => {
                                const highlightNumbers = (text: any): any => {
                                  if (typeof text !== 'string') return text;
                                  const parts = text.split(/([0-9]+(?:[.,][0-9]+)?%?)/g);
                                  return parts.map((part, i) => {
                                    if (/^[0-9]+(?:[.,][0-9]+)?%?$/.test(part)) {
                                      return (
                                        <span key={i} className="font-semibold text-primary">
                                          {part}
                                        </span>
                                      );
                                    }
                                    return part;
                                  });
                                };
                                
                                const processChildren = (children: any): any => {
                                  if (typeof children === 'string') {
                                    return highlightNumbers(children);
                                  }
                                  if (Array.isArray(children)) {
                                    return children.map((child, i) => {
                                      if (typeof child === 'string') {
                                        return <span key={i}>{highlightNumbers(child)}</span>;
                                      }
                                      return child;
                                    });
                                  }
                                  return children;
                                };
                                
                                return (
                                  <li className="pl-2 text-foreground" {...props}>
                                    {processChildren(children)}
                                  </li>
                                );
                              },
                              strong: ({ node, ...props }) => (
                                <strong
                                  className="font-semibold text-primary"
                                  {...props}
                                />
                              ),
                              a: ({ node, href, children, ...props }) => {
                                const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                                  const isMobile = window.innerWidth < 768;
                                  if (!isMobile && href) {
                                    // Check if it's an auction link
                                    const auctionMatch = href.match(/\/auction\/([a-f0-9-]+)\/(client|vendor)/);
                                    if (auctionMatch) {
                                      e.preventDefault();
                                      setLiveAuctionId(auctionMatch[1]);
                                      setSplitScreenActive(true);
                                    }
                                  }
                                };
                                
                                return (
                                  <a
                                    className="text-muted-foreground hover:text-muted-foreground underline decoration-blue-400/30 hover:decoration-blue-600 transition-colors cursor-pointer"
                                    href={href}
                                    onClick={handleLinkClick}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    {...props}
                                  >
                                    {children}
                                  </a>
                                );
                              },
                              blockquote: ({ node, ...props }) => (
                                <blockquote
                                  className="border-l-4 border-primary/35 pl-4 py-2 my-3 italic bg-primary/10 rounded-r"
                                  {...props}
                                />
                              ),
                              h1: ({ node, ...props }) => (
                                <h1 className="text-xl font-bold mb-3 mt-4 text-foreground" {...props} />
                              ),
                              h2: ({ node, ...props }) => (
                                <h2 className="text-lg font-bold mb-2 mt-3 text-foreground" {...props} />
                              ),
                              h3: ({ node, ...props }) => (
                                <h3 className="text-base font-semibold mb-2 mt-3 text-primary" {...props} />
                              ),
                              hr: ({ node, ...props }) => (
                                <hr className="my-4 border-t border-border" {...props} />
                              ),
                              code: ({ node, inline, ...props }: any) =>
                                inline ? (
                                  <code
                                    className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-mono border border-primary/35"
                                    {...props}
                                  />
                                ) : (
                                  <code
                                    className="my-3 block overflow-x-auto rounded-xl border border-border bg-secondary p-4 font-mono text-xs text-foreground"
                                    {...props}
                                  />
                                ),
                              table: ({ node, ...props }) => (
                                <div className="my-3 overflow-x-auto rounded-xl border border-border">
                                  <table className="w-full min-w-full text-sm tabular" {...props} />
                                </div>
                              ),
                              th: ({ node, ...props }) => (
                                <th className="border-b border-border bg-secondary px-3 py-2.5 text-left text-label text-muted-foreground" {...props} />
                              ),
                              td: ({ node, ...props }) => (
                                <td className="border-b border-border/60 px-3 py-2.5 align-top" {...props} />
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      )}

                      {/* Display tool results with download options */}
                      {message.toolCalls && message.toolCalls.length > 0 && (
                        <div className="mt-4 space-y-2">
                          {message.toolCalls.map((tool, idx) => {
                            // Check if this is an RFP generation with PDF
                            const hasPdf =
                              tool.result &&
                              typeof tool.result === "object" &&
                              tool.result.pdf_path;
                            const rfpNumber =
                              tool.result &&
                              typeof tool.result === "object" &&
                              tool.result.rfp_number;
                            const reportTitle =
                              tool.result &&
                              typeof tool.result === "object" &&
                              tool.result.report_title;

                            // RFP Download Button
                            if (hasPdf && tool.name === "create_rfp") {
                              return (
                                <div
                                  key={idx}
                                  className="flex items-center gap-3 p-3 rounded-lg bg-primary/12 border border-primary/30"
                                >
                                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" aria-hidden="true" />
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-primary">
                                      RFP generated, {rfpNumber}
                                    </p>
                                    <p className="text-xs text-primary mt-0.5">
                                      Document ready for download
                                    </p>
                                  </div>
                                  <a
                                    href={`/api/download-rfp?path=${encodeURIComponent(
                                      tool.result.pdf_path
                                    )}`}
                                    download
                                    className="flex items-center gap-1.5 px-3 md:px-4 py-2 bg-primary hover:bg-primary text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                                  >
                                    <span>📥</span>
                                    <span className="hidden sm:inline">Download PDF</span>
                                    <span className="sm:hidden">PDF</span>
                                  </a>
                                </div>
                              );
                            }

                            // Report Download Button
                            if (
                              hasPdf &&
                              tool.name === "generate_executive_report"
                            ) {
                              return (
                                <div
                                  key={idx}
                                  className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/35"
                                >
                                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" aria-hidden="true" />
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-primary">
                                      {reportTitle || "Executive report"}{" "}
                                      Generated
                                    </p>
                                    <p className="text-xs text-primary mt-0.5">
                                      Report ready for download
                                    </p>
                                  </div>
                                  <a
                                    href={
                                      tool.result.downloadUrl ||
                                      tool.result.pdf_path
                                    }
                                    download
                                    className="flex items-center gap-1.5 px-3 md:px-4 py-2 bg-primary hover:bg-primary text-white text-xs font-medium rounded-lg transition-colors whitespace-nowrap"
                                  >
                                    <span>📥</span>
                                    <span className="hidden sm:inline">Download Report</span>
                                    <span className="sm:hidden">Report</span>
                                  </a>
                                </div>
                              );
                            }

                            // For email sent successfully
                            if (
                              tool.status === "success" &&
                              tool.name === "send_email"
                            ) {
                              return (
                                <div
                                  key={idx}
                                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary border border-border"
                                >
                                  <CheckCircle className="h-5 w-5 text-muted-foreground flex-shrink-0" aria-hidden="true" />
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-muted-foreground">
                                      Email sent
                                    </p>
                                    {tool.result &&
                                      typeof tool.result === "object" &&
                                      tool.result.message && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          {tool.result.message}
                                        </p>
                                      )}
                                  </div>
                                </div>
                              );
                            }

                            // For email send failed
                            if (
                              tool.status === "error" &&
                              tool.name === "send_email"
                            ) {
                              return (
                                <div
                                  key={idx}
                                  className="flex items-center gap-3 p-3 rounded-lg bg-destructive/15 border border-destructive/40"
                                >
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-red-400">
                                      ✗ Email Failed to Send
                                    </p>
                                    {tool.result &&
                                      typeof tool.result === "object" &&
                                      tool.result.error && (
                                        <p className="text-xs text-red-400 mt-0.5">
                                          {tool.result.error}
                                        </p>
                                      )}
                                  </div>
                                </div>
                              );
                            }

                            // Generic tool success message for other tools
                            if (
                              tool.status === "success" &&
                              tool.name === "draft_negotiation" &&
                              tool.result?.awaiting_approval &&
                              user?.email
                            ) {
                              return (
                                <ApprovalCard
                                  key={idx}
                                  negotiationId={tool.result.negotiation_id}
                                  vendor={tool.result.vendor}
                                  vendorEmail={tool.result.vendor_email}
                                  currentAmount={tool.result.current_amount}
                                  askingFor={tool.result.asking_for}
                                  potentialSaving={tool.result.potential_saving}
                                  leverage={tool.result.leverage}
                                  subject={tool.result.subject}
                                  body={tool.result.body}
                                  customerEmail={user.email}
                                  userId={user.id}
                                />
                              );
                            }

                            if (tool.status === "success") {
                              return (
                                <div
                                  key={idx}
                                  className="flex items-center gap-3 p-3 rounded-lg bg-secondary border border-border"
                                >
                                  <CheckCircle className="h-5 w-5 text-primary flex-shrink-0" aria-hidden="true" />
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-foreground">
                                      {formatToolName(tool.name)}
                                    </p>
                                    {tool.result &&
                                      typeof tool.result === "object" &&
                                      tool.result.message && (
                                        <p className="text-xs text-muted-foreground mt-0.5">
                                          {tool.result.message}
                                        </p>
                                      )}
                                  </div>
                                  {tool.name === "check_quotes" &&
                                    tool.result?.count > 0 &&
                                    tool.result?.quotes?.[0]?.rfp && (
                                      <motion.div
                                        layoutId="quote-comparison-panel"
                                        transition={spring.surface}
                                        className="flex-shrink-0"
                                      >
                                        <Button
                                          size="sm"
                                          onClick={() => setComparisonRfp(tool.result.quotes[0].rfp)}
                                        >
                                          <BarChart3 className="h-3.5 w-3.5" aria-hidden="true" />
                                          Compare {tool.result.count} quotes
                                        </Button>
                                      </motion.div>
                                    )}
                                </div>
                              );
                            }

                            // Generic tool error message
                            if (tool.status === "error") {
                              return (
                                <div
                                  key={idx}
                                  className="flex items-center gap-3 p-3 rounded-lg bg-destructive/15 border border-destructive/40"
                                >
                                  <XCircle className="h-5 w-5 text-red-400 flex-shrink-0" aria-hidden="true" />
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-red-400">
                                      ✗ {formatToolName(tool.name)} Failed
                                    </p>
                                    {tool.result &&
                                      typeof tool.result === "object" &&
                                      tool.result.error && (
                                        <p className="text-xs text-red-400 mt-0.5">
                                          {tool.result.error}
                                        </p>
                                      )}
                                  </div>
                                </div>
                              );
                            }

                            return null;
                          })}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))}

                {/* Streaming content */}
                {streamingContent && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                    aria-live="polite"
                  >
                    <div className="max-w-[85%] md:max-w-[80%] rounded-2xl px-4 md:px-6 py-3 md:py-4 panel">
                      <div className="text-sm text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none font-body">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            p: ({ node, ...props }) => (
                              <p className="mb-3 last:mb-0 leading-relaxed" {...props} />
                            ),
                            ul: ({ node, ...props }) => (
                              <ul
                                className="mb-4 ml-5 space-y-2 [&>li::marker]:text-primary dark:[&>li::marker]:text-primary"
                                style={{ listStyleType: 'disc' }}
                                {...props}
                              />
                            ),
                            ol: ({ node, ...props }) => (
                              <ol
                                className="mb-4 ml-5 space-y-2 [&>li::marker]:text-primary dark:[&>li::marker]:text-primary [&>li::marker]:font-semibold"
                                style={{ listStyleType: 'decimal' }}
                                {...props}
                              />
                            ),
                            li: ({ node, ...props }) => (
                              <li className="pl-2 text-foreground" {...props} />
                            ),
                            strong: ({ node, ...props }) => (
                              <strong
                                className="font-semibold text-primary"
                                {...props}
                              />
                              ),
                            a: ({ node, ...props }) => (
                              <a
                                className="text-muted-foreground hover:text-muted-foreground underline decoration-blue-400/30 hover:decoration-blue-600 transition-colors"
                                target="_blank"
                                rel="noopener noreferrer"
                                {...props}
                              />
                            ),
                            blockquote: ({ node, ...props }) => (
                              <blockquote
                                className="border-l-4 border-primary/35 pl-4 py-2 my-3 italic bg-primary/10 rounded-r"
                                {...props}
                              />
                            ),
                            h1: ({ node, ...props }) => (
                              <h1 className="text-xl font-bold mb-3 mt-4 text-foreground" {...props} />
                            ),
                            h2: ({ node, ...props }) => (
                              <h2 className="text-lg font-bold mb-2 mt-3 text-foreground" {...props} />
                            ),
                            h3: ({ node, ...props }) => (
                              <h3 className="text-base font-semibold mb-2 mt-3 text-primary" {...props} />
                            ),
                            hr: ({ node, ...props }) => (
                              <hr className="my-4 border-t border-border" {...props} />
                            ),
                            code: ({ node, inline, ...props }: any) =>
                              inline ? (
                                <code
                                  className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-mono border border-primary/35"
                                  {...props}
                                />
                              ) : (
                                <code
                                  className="my-3 block overflow-x-auto rounded-xl border border-border bg-secondary p-4 font-mono text-xs text-foreground"
                                  {...props}
                                />
                              ),
                            table: ({ node, ...props }) => (
                              <div className="my-3 overflow-x-auto rounded-xl border border-border">
                                <table className="w-full min-w-full text-sm tabular" {...props} />
                              </div>
                            ),
                            th: ({ node, ...props }) => (
                              <th className="border-b border-border bg-secondary px-3 py-2.5 text-left text-label text-muted-foreground" {...props} />
                            ),
                            td: ({ node, ...props }) => (
                              <td className="border-b border-border/60 px-3 py-2.5 align-top" {...props} />
                            ),
                          }}
                        >
                          {streamingContent}
                        </ReactMarkdown>
                      </div>
                      <span className="inline-block w-1 h-4 ml-1 bg-primary animate-pulse" />
                    </div>
                  </motion.div>
                )}

                {/* Agent run trace: one row per tool call, filling in while it
                    runs and collapsing into a receipt when it settles. */}
                {liveToolCalls.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                  >
                    <div
                      className="w-full max-w-[90%] rounded-[var(--radius)] panel px-4 py-3.5 font-body md:max-w-[80%] md:px-5 md:py-4"
                      aria-live="polite"
                    >
                      <p className="mb-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
                        Agent activity
                      </p>
                      <div className="space-y-2">
                        {liveToolCalls.map((tool, idx) => {
                          const running = tool.status === "calling";
                          const failed = tool.status === "error";
                          const outcome = !running ? stepOutcome(tool.name, tool.result) : null;
                          const isExpanded = !!tool.id && expandedToolIds.has(tool.id);
                          const entry = enterItem(idx);
                          return (
                            <motion.div
                              key={tool.id || idx}
                              layout
                              initial={entry.initial}
                              animate={entry.animate}
                              transition={{ ...entry.transition, layout: spring.surface }}
                            >
                              {running ? (
                                <div className="relative h-9 overflow-hidden rounded-[var(--radius-inner)] border border-border bg-sunken">
                                  <motion.div
                                    className="absolute inset-y-0 left-0 bg-primary/15"
                                    style={{ transformOrigin: "left" }}
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: 0.85 }}
                                    transition={spring.surface}
                                  />
                                  <div className="relative z-10 flex h-full items-center gap-2 px-3">
                                    <span
                                      className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-primary animate-pulse"
                                      aria-hidden="true"
                                    />
                                    <span className="truncate text-sm font-medium text-foreground">
                                      {stepLabel(tool.name)}
                                    </span>
                                  </div>
                                </div>
                              ) : (
                                <div>
                                  <button
                                    type="button"
                                    onClick={() => toggleToolExpanded(tool.id)}
                                    aria-expanded={isExpanded}
                                    className="flex w-full items-center gap-2 rounded-[var(--radius-inner)] border border-border bg-secondary/50 px-3 py-2 text-left transition-[background-color,border-color] duration-150 hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                  >
                                    {failed ? (
                                      <XCircle className="h-4 w-4 flex-shrink-0 text-destructive" aria-hidden="true" />
                                    ) : (
                                      <CheckCircle className="h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
                                    )}
                                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                                      {stepLabel(tool.name)}
                                      {outcome && (
                                        <span className="text-muted-foreground"> · {outcome}</span>
                                      )}
                                    </span>
                                    <ChevronDown
                                      className={`h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-150 ${
                                        isExpanded ? "rotate-180" : ""
                                      }`}
                                      aria-hidden="true"
                                    />
                                  </button>
                                  {isExpanded && (
                                    <div className="mt-1 space-y-2 rounded-[var(--radius-inner)] border border-border bg-sunken p-3 text-xs">
                                      <div>
                                        <p className="font-medium text-muted-foreground">Arguments</p>
                                        <pre className="figure mt-1 overflow-x-auto whitespace-pre-wrap break-words text-foreground">
                                          {JSON.stringify(tool.args, null, 2)}
                                        </pre>
                                      </div>
                                      {tool.result !== undefined && (
                                        <div>
                                          <p className="font-medium text-muted-foreground">Result</p>
                                          <pre className="figure mt-1 overflow-x-auto whitespace-pre-wrap break-words text-foreground">
                                            {JSON.stringify(tool.result, null, 2)}
                                          </pre>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}

                {/* Skeleton matching the shape of the incoming message, replacing the old spinner */}
                {isProcessing && !streamingContent && liveToolCalls.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-start"
                    aria-live="polite"
                    aria-label="Assistant is preparing a response…"
                  >
                    <div className="w-full max-w-[85%] space-y-2 rounded-[var(--radius)] panel px-4 py-4 md:max-w-[80%] md:px-6">
                      <div
                        className={`h-3 w-3/4 rounded-[var(--radius-inner)] bg-sunken ${prefersReducedMotion ? "" : "animate-pulse"}`}
                      />
                      <div
                        className={`h-3 w-1/2 rounded-[var(--radius-inner)] bg-sunken ${prefersReducedMotion ? "" : "animate-pulse"}`}
                      />
                      <div
                        className={`h-3 w-5/6 rounded-[var(--radius-inner)] bg-sunken ${prefersReducedMotion ? "" : "animate-pulse"}`}
                      />
                    </div>
                  </motion.div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}

            {/* Chat Composer - Fixed at bottom when chat has started */}
            {hasStartedChat && chatMessages.length > 0 && (
              <motion.div
                initial={{ y: 0, position: "relative" }}
                animate={{
                  y: 0,
                  position: "fixed" as const,
                  bottom: 0,
                  left: 0,
                  right: 0,
                }}
                transition={{ duration: 0.5, ease: "easeInOut" }}
                className="z-10 ml-0 bg-[linear-gradient(to_top,hsl(var(--background))_0%,hsl(var(--background)/0.98)_70%,transparent_100%)] px-3 pb-24 md:ml-20 md:px-6 md:pb-6"
              >
                <div className="max-w-3xl mx-auto space-y-2">
                  {renderSuggestedActions(true)}

                  {/* Contextual Suggestions */}
                  <AnimatePresence>
                    {suggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 10 }}
                        className="flex items-center gap-2 flex-wrap"
                      >
                        <span className="text-xs text-muted-foreground font-medium">
                          
                        </span>
                        {suggestions.map((suggestion, idx) => (
                          <motion.button
                            key={idx}
                            onClick={() => {
                              setInjectedPrompt(suggestion);
                              setSuggestions([]);
                            }}
                            className="rounded-full border border-primary/35 bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary transition-colors hover:border-primary/35 hover:bg-primary/10"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                          >
                            {suggestion}
                          </motion.button>
                        ))}
                        <button
                          type="button"
                          onClick={() => setSuggestions([])}
                          aria-label="Dismiss suggestions"
                          className="text-xs text-muted-foreground hover:text-muted-foreground ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
                        >
                          <X className="h-3 w-3" aria-hidden="true" />
                        </button>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <ChatComposer
                    onSubmit={handleSearch}
                    isLoading={isProcessing}
                    chatCredits={chatCredits}
                    documentCredits={documentCredits}
                    userEmail={user?.email}
                    userId={user?.id}
                    initialPrompt={injectedPrompt}
                    onPromptInjected={() => setInjectedPrompt('')}
                    hasStartedChat={hasStartedChat}
                  />
                </div>
              </motion.div>
            )}

            {/* Results */}
            {!isProcessing && results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="w-full space-y-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-semibold text-foreground">
                    Top Matches
                  </h2>
                  <Button
                    variant="link"
                    size="sm"
                    onClick={() => setResults([])}
                    className="text-primary"
                  >
                    New Search
                  </Button>
                </div>

                <div className="space-y-4">
                  {results.map((result) => (
                    <div
                      key={result.id}
                      className="panel panel-interactive p-6"
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-semibold text-foreground">
                          {result.supplier}
                        </h3>
                        <span className="text-sm font-medium text-primary">
                          {result.match}% Match
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* Empty state - Welcome screen */}
            {!isProcessing &&
              results.length === 0 &&
              chatMessages.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full space-y-12"
                >
                  {/* Welcome Greeting */}
                  <div className="text-center space-y-2">
                    <h1 className="text-balance px-4 text-2xl font-semibold tracking-tight text-foreground md:text-3xl lg:text-4xl">
                      {greeting}, {user?.name?.split(" ")[0] || "there"}
                    </h1>
                    <p className="px-4 text-base text-muted-foreground">
                      Here is what needs you today.
                    </p>
                  </div>

                  {/* Suggested actions. Not the clock: these are things the
                      user can go and do, so they sit with the input. Kept
                      translucent and borderless-ish so they read as an
                      addition to the composer, not as chat content. */}
                  <div className="mx-auto w-full max-w-3xl">
              {/* Today's briefing: the live facts that are the entry points */}
              <div className="mx-auto w-full max-w-[1100px] px-2 md:px-0 xl:max-w-none xl:px-0">
                {briefingLoading ? (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-12" aria-hidden="true">
                    <div className="h-28 rounded-[var(--radius)] border border-border bg-sunken animate-pulse md:col-span-7" />
                    <div className="h-28 rounded-[var(--radius)] border border-border bg-sunken animate-pulse md:col-span-5" />
                    <div className="h-24 rounded-[var(--radius)] border border-border bg-sunken animate-pulse md:col-span-5" />
                    <div className="h-24 rounded-[var(--radius)] border border-border bg-sunken animate-pulse md:col-span-7" />
                  </div>
                ) : (
                  (() => {
                    const facts = buildBriefingFacts();
                    if (facts.length === 0) {
                      return (
                        <button
                          type="button"
                          onClick={() => handleQuickAction("rfp")}
                          className="panel panel-interactive w-full rounded-[var(--radius)] border border-border p-5 text-left transition-[border-color,background-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          <p className="text-sm font-medium text-foreground">
                            Nothing needs you right now.
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            Describe what to buy and Procurix drafts the RFP.
                          </p>
                        </button>
                      );
                    }
                    // Asymmetric spans, so the row does not read as
                    // equal cards. Cell count always matches fact count.
                    const SPANS = [
                      "md:col-span-6",
                      "md:col-span-6",
                      "md:col-span-6",
                      "md:col-span-6",
                    ];
                    return (
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
                        {facts.map((fact, i) => (
                          <BriefingRow
                            key={fact.key}
                            fact={fact}
                            index={i}
                            large={i < 2}
                            className={SPANS[i % SPANS.length]}
                          />
                        ))}
                      </div>
                    );
                  })()
                )}
              </div>
                  </div>

                  {/* Chat Composer */}
                  <div className="max-w-3xl mx-auto w-full" data-chat-composer>
                    <ChatComposer
                      onSubmit={handleSearch}
                      isLoading={isProcessing}
                      chatCredits={chatCredits}
                      documentCredits={documentCredits}
                      userEmail={user?.email}
                      userId={user?.id}
                      initialPrompt={injectedPrompt}
                      onPromptInjected={() => setInjectedPrompt('')}
                      hasStartedChat={hasStartedChat}
                    />
                  </div>

                </motion.div>
              )}

            {/* The 43B(h) clock is the alert, so it sits top right and stays
                there. Translucent and collapsible on purpose: it has to read
                as something laid over the conversation, not a message in it. */}
            {user?.email && (
              <div
                id="compliance-radar"
                className={`mt-6 w-full scroll-mt-6 xl:fixed xl:right-5 xl:top-5 xl:z-30 xl:mt-0 ${
                  clockHidden ? 'xl:w-auto' : 'xl:w-[340px]'
                }`}
              >
                {clockHidden ? (
                  <button
                    type="button"
                    onClick={toggleClock}
                    aria-expanded={false}
                    aria-controls="compliance-radar-card"
                    className="ml-auto flex items-center gap-2 rounded-[var(--radius-inner)] border border-border/70 bg-surface/80 px-3 py-2 text-xs backdrop-blur-xl transition-colors duration-150 hover:border-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ShieldAlert
                      className={`h-4 w-4 ${briefing && briefing.amountAtRisk > 0 ? 'text-breach' : 'text-safe'}`}
                      aria-hidden="true"
                    />
                    <span className="text-muted-foreground">43B(h)</span>
                    {briefing && briefing.amountAtRisk > 0 && (
                      <span className="figure font-semibold text-breach">
                        {formatINRCompact(briefing.amountAtRisk)}
                      </span>
                    )}
                    <span className="sr-only">Show the payment clock</span>
                  </button>
                ) : (
                <div id="compliance-radar-card" className="rounded-[var(--radius)] border border-border/70 bg-surface/70 backdrop-blur-xl">
                  <MsmeRadar
                    key={msmeRefreshKey}
                    customerEmail={user.email}
                    onHide={toggleClock}
                  />
                </div>
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Split-Screen Mode Overlay - Desktop Only */}
      <FramerAnimatePresence>
        {splitScreenActive && liveAuctionId && (
          <motion.div
            layoutId="live-auction-panel"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={spring.surface}
            className="hidden md:block"
          >
            <SplitScreenLayout
              onClose={handleExitSplitScreen}
              leftContent={
              <div className="h-full flex flex-col bg-background p-6">
                <div className="flex-1 overflow-y-auto mb-4 pr-3">
                  <div className="max-w-3xl mx-auto space-y-6">
                    {chatMessages.map((message) => (
                      <motion.div
                        key={message.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${
                          message.role === "user" ? "justify-end" : "justify-start"
                        }`}
                      >
                        <div
                          className={
                            message.role === "user"
                              ? "max-w-[80%] rounded-2xl bg-primary px-6 py-4 text-primary-foreground"
                              : "panel w-full max-w-full px-6 py-4"
                          }
                        >
                          {message.role === "user" ? (
                            <p className="text-sm leading-relaxed whitespace-pre-wrap">
                              {message.content}
                            </p>
                          ) : (
                            <div className="text-sm leading-relaxed text-foreground prose prose-sm dark:prose-invert max-w-none">
                              <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                  p: ({ node, ...props }) => (
                                    <p className="mb-3 last:mb-0 leading-relaxed" {...props} />
                                  ),
                                  ul: ({ node, ...props }) => (
                                    <ul
                                      className="mb-4 ml-5 space-y-2 [&>li::marker]:text-primary dark:[&>li::marker]:text-primary"
                                      style={{ listStyleType: 'disc' }}
                                      {...props}
                                    />
                                  ),
                                  ol: ({ node, ...props }) => (
                                    <ol
                                      className="mb-4 ml-5 space-y-2 [&>li::marker]:text-primary dark:[&>li::marker]:text-primary [&>li::marker]:font-semibold"
                                      style={{ listStyleType: 'decimal' }}
                                      {...props}
                                    />
                                  ),
                                  li: ({ node, ...props }) => (
                                    <li className="pl-2 text-foreground" {...props} />
                                  ),
                                  strong: ({ node, ...props }) => (
                                    <strong
                                      className="font-semibold text-primary"
                                      {...props}
                                    />
                                  ),
                                  a: ({ node, ...props }) => (
                                    <a
                                      className="text-muted-foreground hover:text-muted-foreground underline decoration-blue-400/30 hover:decoration-blue-600 transition-colors"
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      {...props}
                                    />
                                  ),
                                  blockquote: ({ node, ...props }) => (
                                    <blockquote
                                      className="border-l-4 border-primary/35 pl-4 py-2 my-3 italic bg-primary/10 rounded-r"
                                      {...props}
                                    />
                                  ),
                                  h1: ({ node, ...props }) => (
                                    <h1 className="text-xl font-bold mb-3 mt-4 text-foreground" {...props} />
                                  ),
                                  h2: ({ node, ...props }) => (
                                    <h2 className="text-lg font-bold mb-2 mt-3 text-foreground" {...props} />
                                  ),
                                  h3: ({ node, ...props }) => (
                                    <h3 className="text-base font-semibold mb-2 mt-3 text-primary" {...props} />
                                  ),
                                  code: ({ node, inline, ...props }: any) =>
                                    inline ? (
                                      <code
                                        className="px-2 py-0.5 bg-primary/10 text-primary rounded text-xs font-mono border border-primary/35"
                                        {...props}
                                      />
                                    ) : (
                                      <code
                                        className="my-3 block overflow-x-auto rounded-lg border border-border bg-secondary p-3 font-mono text-xs text-foreground"
                                        {...props}
                                      />
                                    ),
                                }}
                              >
                                {message.content}
                              </ReactMarkdown>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    ))}
                    {streamingContent && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex justify-start"
                      >
                        <div className="max-w-[80%] rounded-2xl px-6 py-4 panel">
                          <div className="text-sm text-foreground leading-relaxed prose prose-sm dark:prose-invert max-w-none">
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
                              {streamingContent}
                            </ReactMarkdown>
                          </div>
                          <span className="inline-block w-1 h-4 ml-1 bg-primary animate-pulse" />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <div className="max-w-3xl mx-auto">
                    <ChatComposer
                      onSubmit={handleSearch}
                      isLoading={isProcessing}
                      chatCredits={chatCredits}
                      documentCredits={documentCredits}
                      userEmail={user?.email}
                      userId={user?.id}
                      initialPrompt={injectedPrompt}
                      onPromptInjected={() => setInjectedPrompt('')}
                      hasStartedChat={hasStartedChat}
                    />
                  </div>
                </div>
              </div>
            }
            rightContent={
              <LiveAuctionFeed auctionId={liveAuctionId} />
            }
            />
          </motion.div>
        )}

        {comparisonRfp && user?.email && (
          <motion.div
            layoutId="quote-comparison-panel"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={spring.surface}
            className="hidden md:block"
          >
            <SplitScreenLayout
              title={`Comparing quotes: ${comparisonRfp}`}
              showLiveDot={false}
              singlePane
              onClose={() => setComparisonRfp(null)}
              leftContent={
                <div className="h-full flex flex-col bg-background p-5">
                  <div className="flex-1 overflow-y-auto pr-2">
                    <div className="space-y-3">
                      {chatMessages.slice(-8).map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`px-4 py-2.5 rounded-2xl min-w-0 ${
                              message.role === "user"
                                ? "max-w-[85%] bg-primary text-white"
                                : "panel w-full"
                            }`}
                          >
                            {message.role === "user" ? (
                              <p className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</p>
                            ) : (
                              <div className="text-sm leading-relaxed">
                                <ReactMarkdown
                                  remarkPlugins={[remarkGfm]}
                                  components={{
                                    p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
                                    table: ({ node, ...props }) => (
                                      <div className="my-2 overflow-x-auto rounded-lg border border-border">
                                        <table className="w-full text-xs" {...props} />
                                      </div>
                                    ),
                                    thead: ({ node, ...props }) => (
                                      <thead className="bg-primary/10" {...props} />
                                    ),
                                    th: ({ node, ...props }) => (
                                      <th className="px-2.5 py-1.5 text-left font-semibold whitespace-nowrap" {...props} />
                                    ),
                                    td: ({ node, ...props }) => (
                                      <td className="px-2.5 py-1.5 border-t border-border whitespace-nowrap" {...props} />
                                    ),
                                    ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 space-y-0.5" {...props} />,
                                    ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5" {...props} />,
                                    strong: ({ node, ...props }) => <strong className="font-semibold" {...props} />,
                                    a: ({ node, ...props }) => <a className="text-primary underline" {...props} />,
                                    code: ({ node, ...props }) => (
                                      <code className="px-1 py-0.5 rounded bg-secondary text-[11px]" {...props} />
                                    ),
                                  }}
                                >
                                  {message.content}
                                </ReactMarkdown>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              }
              rightContent={
                <QuoteComparison
                  rfpNumber={comparisonRfp}
                  customerEmail={user.email}
                  userId={user.id}
                  onAwarded={(vendor) => {
                    setMsmeRefreshKey((k) => k + 1);
                    setChatMessages((prev) => [
                      ...prev,
                      {
                        id: `msg-${Date.now()}`,
                        role: "assistant",
                        content: `Awarded ${comparisonRfp} to ${vendor}. The purchase order has been generated.`,
                        timestamp: Date.now(),
                      },
                    ]);
                  }}
                />
              }
            />
          </motion.div>
        )}
      </FramerAnimatePresence>
    </>
  );
};

export default Index;