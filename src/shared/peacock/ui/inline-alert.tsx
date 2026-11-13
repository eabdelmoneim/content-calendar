import { CircleCheck, CircleX, Hand, Info, TriangleAlert } from "lucide-react";
import type { ReactNode } from "react";
import { cx, ICON_SIZE, ICON_STROKE } from "./cx";
import styles from "./inline-alert.module.css";

export type InlineAlertTone =
  "info" | "warning" | "danger" | "success" | "review";

const DEFAULT_ICONS = {
  info: Info,
  warning: TriangleAlert,
  danger: CircleX,
  success: CircleCheck,
  review: Hand,
} as const;

export type InlineAlertProps = {
  tone?: InlineAlertTone;
  children: ReactNode;
  /** Override the tone icon, e.g. <Unplug/> for a disconnected account. */
  icon?: ReactNode;
  /** Optional right-aligned action (link or small button). */
  action?: ReactNode;
  /**
   * Live-region role. Defaults to "alert" for danger, "status" otherwise.
   * Pass "none" for static page copy that should not be announced.
   */
  role?: "alert" | "status" | "none";
  className?: string;
};

/** Tinted in-flow message (COMPONENTS.md › InlineAlert). */
export function InlineAlert({
  tone = "info",
  children,
  icon,
  action,
  role,
  className,
}: InlineAlertProps): React.JSX.Element {
  const Icon = DEFAULT_ICONS[tone];
  const resolvedRole = role ?? (tone === "danger" ? "alert" : "status");
  return (
    <div
      role={resolvedRole === "none" ? undefined : resolvedRole}
      className={cx(styles.alert, styles[tone], className)}
    >
      <span className={styles.icon} aria-hidden>
        {icon ?? <Icon size={ICON_SIZE} strokeWidth={ICON_STROKE} />}
      </span>
      <div className={styles.body}>{children}</div>
      {action ? <div className={styles.action}>{action}</div> : null}
    </div>
  );
}
