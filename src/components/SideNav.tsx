import React, { useState, useEffect, useRef } from "react";
import {
  Scale,
  Home,
  Settings,
  Zap,
  LogOut,
  CreditCard,
  Package,
  Gavel,
  MessageSquare,
  FileStack,
  Loader2,
  Plus,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { spring } from "@/lib/motion";
import { useRouter } from "next/router";
import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

interface SideNavProps {
  activePage?: string;
  onHomeClick?: () => void;
  user?: {
    id: string;
    email: string;
    name: string;
    picture?: string;
  } | null;
  customerData?: {
    plan_name: string;
    total_chat_credit: number;
    total_doc_credit: number;
    subscription_status: string;
  } | null;
  chatCredits?: { total: number; isUnlimited: boolean };
  documentCredits?: { total: number; isUnlimited: boolean };
  creditsLoading?: boolean;
  onUpgrade?: () => void;
  onLogout?: () => void;
}

type NavUser = NonNullable<SideNavProps["user"]>;

const getProfilePictureUrl = (email?: string): string => {
  if (!email) return "";
  return `/api/user/profile-picture?email=${encodeURIComponent(email)}`;
};

const activeNavClasses = "bg-primary text-primary-foreground";
const idleNavClasses =
  "text-muted-foreground hover:bg-secondary hover:text-foreground";

const Avatar: React.FC<{ user: NavUser; size: number; rounded?: string }> = ({
  user,
  size,
  rounded = "rounded-xl",
}) => {
  const [failed, setFailed] = useState(false);
  const initial = user.name?.charAt(0).toUpperCase() || "U";
  const dimension = { width: size, height: size };

  if (!user.picture || failed) {
    return (
      <div
        style={dimension}
        className={cn(
          rounded,
          "flex flex-shrink-0 items-center justify-center bg-primary font-semibold text-white ring-2 ring-primary/40"
        )}
      >
        {initial}
      </div>
    );
  }

  return (
    <img
      src={getProfilePictureUrl(user.email)}
      alt={user.name}
      loading="lazy"
      style={dimension}
      onError={() => setFailed(true)}
      className={cn(rounded, "flex-shrink-0 object-cover ring-2 ring-primary/40")}
    />
  );
};

const RailButton: React.FC<{
  label: string;
  isActive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, isActive = false, onClick, children }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button
        onClick={onClick}
        aria-label={label}
        aria-current={isActive ? "page" : undefined}
        className={cn(
          "relative flex aspect-square w-full items-center justify-center rounded-xl transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isActive ? activeNavClasses : idleNavClasses
        )}
      >
        <span className="relative z-10" aria-hidden="true">{children}</span>
        {isActive && (
          <motion.div
            layoutId="activeNav"
            className={cn("absolute inset-0 rounded-xl", activeNavClasses)}
            initial={false}
            transition={spring.surface}
            style={{ zIndex: 0 }}
          />
        )}
      </button>
    </TooltipTrigger>
    <TooltipContent side="right" sideOffset={6}>
      {label}
    </TooltipContent>
  </Tooltip>
);

const BarButton: React.FC<{
  label: string;
  isActive?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ label, isActive = false, onClick, children }) => (
  <button
    onClick={onClick}
    aria-current={isActive ? "page" : undefined}
    className={cn(
      "flex flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
      isActive ? activeNavClasses : idleNavClasses
    )}
  >
    <span className="relative z-10" aria-hidden="true">{children}</span>
    <span className="relative z-10 text-label">{label}</span>
  </button>
);

const MenuItem: React.FC<{
  onClick: () => void;
  danger?: boolean;
  children: React.ReactNode;
}> = ({ onClick, danger = false, children }) => (
  <button
    onClick={onClick}
    className={cn(
      "flex w-full items-center gap-3 rounded-lg px-4 py-2.5 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset",
      danger
        ? "text-destructive hover:bg-destructive/10"
        : "text-muted-foreground hover:bg-secondary"
    )}
  >
    {children}
  </button>
);

const CreditRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  value: number;
}> = ({ icon, label, value }) => (
  <div className="flex items-center justify-between text-sm text-muted-foreground">
    <span className="flex items-center gap-1.5">
      {icon}
      {label}
    </span>
    <span className="font-medium tabular">{value === -1 ? "∞" : value || 0}</span>
  </div>
);

const ProfilePanel: React.FC<{
  user: NavUser;
  customerData: SideNavProps["customerData"];
  isLoggingOut: boolean;
  showSettings: boolean;
  onNavigate: (path: string) => void;
  onLogout: () => void;
}> = ({
  user,
  customerData,
  isLoggingOut,
  showSettings,
  onNavigate,
  onLogout,
}) => (
  <>
    <div className="p-4">
      <div className="flex items-center gap-3">
        <Avatar user={user} size={48} rounded="rounded-full" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {user.name}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {user.email}
          </p>
        </div>
      </div>
    </div>

    {customerData && (
      <>
        <Separator />
        <div className="p-4">
          <div className="mb-2 text-label text-muted-foreground">
            CURRENT PLAN
          </div>
          <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
            {customerData.plan_name || "Free Plan"}
            {customerData.plan_name === "plus" && (
              <span className="rounded-full bg-primary px-2 py-0.5 text-label text-primary-foreground">
                PLUS
              </span>
            )}
          </div>

          <div className="space-y-2">
            <CreditRow
              icon={<MessageSquare className="h-4 w-4" aria-hidden="true" />}
              label="Chat Credits"
              value={customerData.total_chat_credit}
            />
            <CreditRow
              icon={<FileStack className="h-4 w-4" aria-hidden="true" />}
              label="Doc Credits"
              value={customerData.total_doc_credit}
            />
          </div>

          {customerData.plan_name !== "plus" && (
            <Button
              onClick={() => onNavigate("/subscription")}
              className="mt-3 w-full"
              size="sm"
            >
              <Zap className="h-4 w-4" aria-hidden="true" />
              Upgrade plan
            </Button>
          )}
        </div>
      </>
    )}

    <Separator />
    <div className="p-2">
      <MenuItem onClick={() => onNavigate("/subscription")}>
        <CreditCard className="h-4 w-4" aria-hidden="true" />
        Billing &amp; subscription
      </MenuItem>
      {showSettings && (
        <MenuItem onClick={() => onNavigate("/settings")}>
          <Settings className="h-4 w-4" aria-hidden="true" />
          Settings
        </MenuItem>
      )}
      <MenuItem onClick={onLogout} danger>
        {isLoggingOut ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <LogOut className="h-4 w-4" aria-hidden="true" />
        )}
        {isLoggingOut ? "Logging out…" : "Logout"}
      </MenuItem>
    </div>
  </>
);

const SideNav: React.FC<SideNavProps> = ({
  activePage = "home",
  onHomeClick,
  user,
  customerData,
  onLogout,
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);

  const router = useRouter();


  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        profileMenuRef.current &&
        !profileMenuRef.current.contains(event.target as Node)
      ) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      if (onLogout) {
        await onLogout();
      }
      router.push("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    } finally {
      setIsLoggingOut(false);
      setShowProfileMenu(false);
    }
  };

  const navItems = [
    { id: "home", label: "Home", icon: Home, path: "/dashboard" },
    { id: "auction", label: "Auctions", icon: Gavel, path: "/auction" },
    { id: "suppliers", label: "Suppliers", icon: Package, path: "/suppliers" },
    { id: "compliance", label: "Compliance", icon: Scale, path: "/compliance" },
  ];

  const handleNavClick = (path: string) => {
    if (path === "/dashboard") {
      if (onHomeClick) {
        onHomeClick();
      }
      if (router.pathname !== "/dashboard") {
        router.push("/dashboard");
      }
    } else {
      router.push(path);
    }
  };

  const startNewChat = () => {
    window.dispatchEvent(new CustomEvent("newChat"));
  };


  const navigateFromMenu = (path: string) => {
    router.push(path);
    setShowProfileMenu(false);
  };

  const panelClasses =
    "panel overflow-hidden rounded-2xl";

  return (
    <TooltipProvider delayDuration={300}>
      <div className="fixed left-0 top-0 z-[60] hidden h-full w-20 flex-col border-r border-border bg-surface/70 backdrop-blur-xl md:flex">
        <div className="flex items-center justify-center border-b border-border p-4">
          <div className="relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl">
            <Image
              src="/procurixlogo_lightmode.png"
              alt="Procurix"
              width={44}
              height={44}
              className="object-contain"
            />
          </div>
        </div>

        <nav className="flex-1 space-y-2 overflow-y-auto p-4">
          {activePage === "home" && (
            <RailButton label="New chat" onClick={startNewChat}>
              <Plus className="h-5 w-5" aria-hidden="true" />
            </RailButton>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <RailButton
                key={item.id}
                label={item.label}
                isActive={activePage === item.id}
                onClick={() => handleNavClick(item.path)}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </RailButton>
            );
          })}
        </nav>

        <div className="space-y-3 border-t border-border p-4">
          <RailButton
            label="Settings"
            isActive={activePage === "settings"}
            onClick={() => router.push("/settings")}
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </RailButton>

          {user && (
            <div className="relative" ref={profileMenuRef}>
              <button
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                aria-label="Account settings"
                aria-haspopup="menu"
                aria-expanded={showProfileMenu}
                className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-xl transition-[box-shadow] duration-200 hover:ring-2 ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Avatar user={user} size={36} />
              </button>

              <AnimatePresence>
                {showProfileMenu && (
                  <motion.div
                    role="menu"
                    initial={shouldReduceMotion ? false : { opacity: 0, x: -10, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, x: -10, scale: 0.95 }}
                    transition={shouldReduceMotion ? { duration: 0 } : spring.surface}
                    style={{ zIndex: 100 }}
                    className={cn("absolute bottom-full left-20 mb-2 w-72", panelClasses)}
                  >
                    <ProfilePanel
                      user={user}
                      customerData={customerData}
                      isLoggingOut={isLoggingOut}
                      showSettings
                      onNavigate={navigateFromMenu}
                      onLogout={handleLogout}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-surface/90 backdrop-blur-xl md:hidden">
        <nav className="safe-area-inset-bottom flex items-center justify-around px-2 py-2">
          {activePage === "home" && (
            <BarButton label="New" onClick={startNewChat}>
              <Plus className="h-5 w-5" aria-hidden="true" />
            </BarButton>
          )}

          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <BarButton
                key={item.id}
                label={item.label}
                isActive={activePage === item.id}
                onClick={() => handleNavClick(item.path)}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </BarButton>
            );
          })}

          <BarButton
            label="Settings"
            isActive={activePage === "settings"}
            onClick={() => router.push("/settings")}
          >
            <Settings className="h-5 w-5" aria-hidden="true" />
          </BarButton>

          {user && (
            <BarButton
              label="Account"
              onClick={() => setShowProfileMenu(!showProfileMenu)}
            >
              <Avatar user={user} size={24} rounded="rounded-full" />
            </BarButton>
          )}
        </nav>

        <AnimatePresence>
          {showProfileMenu && user && (
            <>
              <motion.button
                type="button"
                aria-label="Close menu"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowProfileMenu(false)}
                className="fixed inset-0 z-40 border-0 bg-black/40 p-0"
                style={{ bottom: "64px" }}
              />
              <motion.div
                role="menu"
                initial={shouldReduceMotion ? false : { y: "100%" }}
                animate={{ y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { y: "100%" }}
                transition={shouldReduceMotion ? { duration: 0 } : spring.surface}
                className={cn(
                  "fixed bottom-16 left-0 right-0 z-50 mx-4 mb-2",
                  panelClasses
                )}
              >
                <ProfilePanel
                  user={user}
                  customerData={customerData}
                  isLoggingOut={isLoggingOut}
                  showSettings={false}
                  onNavigate={navigateFromMenu}
                  onLogout={handleLogout}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </TooltipProvider>
  );
};

export default SideNav;
