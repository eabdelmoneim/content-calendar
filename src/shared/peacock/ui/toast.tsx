"use client";

import { CircleAlert, CircleCheck, X } from "lucide-react";
import type { ReactNode } from "react";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cx, ICON_SIZE, ICON_STROKE } from "./cx";
import styles from "./toast.module.css";

export const TOAST_DURATION_MS = 6000;
const MAX_VISIBLE = 3;

export type ToastTone = "neutral" | "success" | "danger";

export type ToastOptions = {
  message: ReactNode;
  tone?: ToastTone;
  /** Optional single action, e.g. { label: "Undo", onAction }. */
  action?: { label: string; onAction: () => void };
  /** ms; defaults to 6s. */
  duration?: number;
};

type ToastRecord = ToastOptions & { id: number };

export type ToastApi = {
  show: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
};

const ToastContext = createContext<ToastApi | null>(null);

/** Access the toast queue. Must be inside <ToastProvider>. */
export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside <ToastProvider>.");
  return api;
}

/**
 * Bottom-centre inverse toasts (COMPONENTS.md › Toast). Announced politely,
 * auto-dismiss after 6s, paused while hovered or focused.
 */
export function ToastProvider({
  children,
}: {
  children: ReactNode;
}): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((options: ToastOptions) => {
    const id = nextId.current;
    nextId.current += 1;
    setToasts((current) =>
      [...current, { ...options, id }].slice(-MAX_VISIBLE),
    );
    return id;
  }, []);

  const api = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={api}>
      {children}
      <section
        className={styles.region}
        aria-label="Notifications"
        aria-live="polite"
        aria-relevant="additions"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </section>
    </ToastContext.Provider>
  );
}

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: ToastRecord;
  onDismiss: (id: number) => void;
}): React.JSX.Element {
  const [paused, setPaused] = useState(false);
  const duration = toast.duration ?? TOAST_DURATION_MS;

  useEffect(() => {
    if (paused) return;
    const timer = setTimeout(() => onDismiss(toast.id), duration);
    return () => clearTimeout(timer);
  }, [paused, duration, onDismiss, toast.id]);

  const tone = toast.tone ?? "neutral";
  const Icon =
    tone === "success" ? CircleCheck : tone === "danger" ? CircleAlert : null;

  return (
    <div
      className={styles.toast}
      onPointerEnter={() => setPaused(true)}
      onPointerLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      {Icon ? (
        <Icon
          className={cx(styles.icon, styles[tone])}
          size={ICON_SIZE}
          strokeWidth={ICON_STROKE}
          aria-hidden
        />
      ) : null}
      <span className={styles.message}>{toast.message}</span>
      {toast.action ? (
        <button
          type="button"
          className={styles.action}
          onClick={() => {
            toast.action?.onAction();
            onDismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      ) : null}
      <button
        type="button"
        className={styles.close}
        aria-label="Dismiss notification"
        onClick={() => onDismiss(toast.id)}
      >
        <X size={14} strokeWidth={ICON_STROKE} aria-hidden />
      </button>
    </div>
  );
}
