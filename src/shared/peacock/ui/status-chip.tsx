import type { LucideIcon } from "lucide-react";
import {
  Check,
  CircleCheck,
  CircleDashed,
  CircleHelp,
  CirclePause,
  CircleX,
  Clock,
  Eye,
  Hand,
  Hourglass,
  Lightbulb,
  LoaderCircle,
  Mail,
  RefreshCw,
  Shield,
  ShieldAlert,
  Timer,
  Unplug,
} from "lucide-react";
import { cx } from "./cx";
import styles from "./status-chip.module.css";

export type ChipTone =
  | "neutral"
  | "blue"
  | "primary"
  | "green"
  | "amber"
  | "red"
  | "violet"
  | "review";

export type ChipStatus =
  | "idea"
  | "planned"
  | "in_review"
  | "scheduled"
  | "published"
  | "queued"
  | "publishing"
  | "failed"
  | "deferred"
  | "needs_review"
  | "connected"
  | "not_connected"
  | "disconnected"
  | "restricted"
  | "cooldown"
  | "refresh_ready"
  | "sending"
  | "sent"
  | "uncertain"
  | "draft_saved"
  | "processing"
  | "invited"
  | "admin"
  | "owner"
  | "editor"
  | "viewer"
  | "global_admin";

type ChipGlyph = LucideIcon | "dot" | "hollow" | null;

export type ChipSpec = {
  tone: ChipTone;
  icon: ChipGlyph;
  label: string;
  spin?: boolean;
};

/**
 * The fixed status map (COMPONENTS.md › StatusChip). Grey is waiting or
 * inactive, blue is moving, indigo and green are good, amber needs a person,
 * red is broken. Do not add statuses or change tones without a design change.
 */
export const CHIP_STATUS_MAP: Readonly<Record<ChipStatus, ChipSpec>> = {
  idea: { tone: "neutral", icon: Lightbulb, label: "Idea" },
  planned: { tone: "blue", icon: CircleDashed, label: "Planned" },
  in_review: { tone: "violet", icon: Eye, label: "In review" },
  scheduled: { tone: "primary", icon: Clock, label: "Scheduled" },
  published: { tone: "green", icon: CircleCheck, label: "Published" },
  queued: { tone: "neutral", icon: Hourglass, label: "Queued" },
  publishing: {
    tone: "blue",
    icon: LoaderCircle,
    label: "Publishing",
    spin: true,
  },
  failed: { tone: "red", icon: CircleX, label: "Failed" },
  deferred: { tone: "amber", icon: CirclePause, label: "Deferred" },
  needs_review: { tone: "review", icon: Hand, label: "Needs manual review" },
  connected: { tone: "green", icon: "dot", label: "Connected" },
  not_connected: { tone: "neutral", icon: "hollow", label: "Not connected" },
  disconnected: { tone: "red", icon: Unplug, label: "Disconnected" },
  restricted: { tone: "amber", icon: ShieldAlert, label: "Restricted" },
  cooldown: { tone: "neutral", icon: Timer, label: "Next refresh in 18h" },
  refresh_ready: {
    tone: "primary",
    icon: RefreshCw,
    label: "Refresh available",
  },
  sending: { tone: "blue", icon: LoaderCircle, label: "Sending", spin: true },
  sent: { tone: "green", icon: Check, label: "Sent" },
  uncertain: { tone: "review", icon: CircleHelp, label: "Delivery uncertain" },
  draft_saved: { tone: "neutral", icon: Check, label: "Draft saved" },
  processing: {
    tone: "blue",
    icon: LoaderCircle,
    label: "Processing",
    spin: true,
  },
  invited: { tone: "neutral", icon: Mail, label: "Invited" },
  admin: { tone: "primary", icon: null, label: "Admin" },
  // Product decision (2026-10-27): workspace leads are Owners; "Admin" means
  // the cross-workspace global admin, shown with `global_admin`.
  owner: { tone: "primary", icon: null, label: "Owner" },
  editor: { tone: "neutral", icon: null, label: "Editor" },
  viewer: { tone: "neutral", icon: null, label: "Viewer" },
  global_admin: { tone: "blue", icon: Shield, label: "Global admin" },
};

export const CHIP_STATUSES = Object.keys(CHIP_STATUS_MAP) as ChipStatus[];

export type StatusChipProps = {
  status: ChipStatus;
  /**
   * Override the label. Use for the relative cooldown form
   * ("Next refresh in 3h"); put the absolute time in `title`.
   */
  label?: string;
  size?: "sm" | "md";
  /** Native tooltip text, e.g. "Available Oct 28, 09:14". */
  title?: string;
  className?: string;
};

/** Every status in the product renders through this chip. Never solid-filled. */
export function StatusChip({
  status,
  label,
  size = "sm",
  title,
  className,
}: StatusChipProps): React.JSX.Element {
  const spec = CHIP_STATUS_MAP[status];
  const iconSize = size === "md" ? 14 : 12;
  const glyph = spec.icon;

  return (
    <span
      className={cx(styles.chip, styles[size], styles[spec.tone], className)}
      data-status={status}
      title={title}
    >
      {glyph === "dot" || glyph === "hollow" ? (
        <span
          className={cx(styles.dot, glyph === "dot" && styles.dotFilled)}
          aria-hidden
        />
      ) : glyph ? (
        <GlyphIcon
          Icon={glyph}
          size={iconSize}
          className={spec.spin ? styles.spin : undefined}
        />
      ) : null}
      <span>{label ?? spec.label}</span>
    </span>
  );
}

function GlyphIcon({
  Icon,
  size,
  className,
}: {
  Icon: LucideIcon;
  size: number;
  className?: string;
}): React.JSX.Element {
  return (
    <Icon
      className={cx(styles.icon, className)}
      size={size}
      strokeWidth={2}
      aria-hidden
    />
  );
}
