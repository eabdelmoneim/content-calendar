"use client";

import { useState, type FormEvent } from "react";
import { useRecordFollowers, useRecordMetrics, type MetricsFields } from "@/lib/api";
import type { Post } from "@/lib/types";
import { Button, Dialog, InlineAlert, Input, Select, useToast } from "@/shared/peacock/ui";
import { formatShortDate } from "@/shared/peacock/format";
import {
  accountLabel,
  followersAt,
  platformName,
  snippet,
  utcDay,
  type Account,
} from "./analytics-model";
import type { FollowerSnapshot } from "@/lib/types";
import styles from "./analytics.module.css";

const FIELDS: Array<{ key: keyof MetricsFields; label: string }> = [
  { key: "impressions", label: "Impressions" },
  { key: "reactions", label: "Reactions" },
  { key: "comments", label: "Comments" },
  { key: "reposts", label: "Reposts" },
  { key: "clicks", label: "Clicks" },
];

type Draft = Record<keyof MetricsFields, string>;

function initialDraft(post: Post): Draft {
  const m = post.metrics;
  const text = (value: number | null | undefined) => (value === null || value === undefined ? "" : String(value));
  return {
    impressions: text(m?.impressions),
    reactions: text(m?.reactions),
    comments: text(m?.comments),
    reposts: text(m?.reposts),
    clicks: text(m?.clicks),
  };
}

/** "" → null; anything else must be a whole number ≥ 0. */
function parseCount(raw: string): number | null | "invalid" {
  const value = raw.trim().replace(/,/g, "");
  if (value === "") return null;
  if (!/^\d+$/.test(value)) return "invalid";
  return Number(value);
}

/** Manual entry of the latest numbers for one published post. */
export function UpdateNumbersDialog({
  post,
  authorName,
  onClose,
}: {
  post: Post;
  authorName: string;
  onClose: () => void;
}): React.JSX.Element {
  const record = useRecordMetrics();
  const toast = useToast();
  const [draft, setDraft] = useState<Draft>(() => initialDraft(post));
  const [errors, setErrors] = useState<Partial<Record<keyof MetricsFields, string>>>({});
  const [formError, setFormError] = useState("");
  const formId = `metrics-${post.id}`;

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    const next: Partial<Record<keyof MetricsFields, string>> = {};
    const metrics = {} as MetricsFields;
    for (const { key } of FIELDS) {
      const parsed = parseCount(draft[key]);
      if (parsed === "invalid") next[key] = "Enter a whole number, or leave it blank.";
      else metrics[key] = parsed;
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    if (FIELDS.every(({ key }) => metrics[key] === null)) {
      setFormError("Enter at least one number.");
      return;
    }
    setFormError("");
    record.mutate(
      { id: post.id, metrics },
      {
        onSuccess: () => {
          toast.show({ message: "Numbers saved", tone: "success" });
          onClose();
        },
        onError: (error) => setFormError(error.message),
      },
    );
  }

  return (
    <Dialog
      open
      size="md"
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Update numbers"
      description={
        <>
          {platformName(post.platform)} · {authorName}
          {post.publishedAt ? ` · ${formatShortDate(utcDay(post.publishedAt))}` : ""} · “{snippet(post.contentText, 70)}”
          <br />
          Copy the current totals from the post&apos;s analytics on {platformName(post.platform)}. Leave a field blank if
          the platform doesn&apos;t show it.
        </>
      }
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={record.isPending}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} loading={record.isPending} loadingLabel="Saving…">
            Save numbers
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.entryForm} onSubmit={submit} noValidate>
        <div className={styles.entryGrid}>
          {FIELDS.map(({ key, label }) => (
            <Input
              key={key}
              label={label}
              inputMode="numeric"
              autoComplete="off"
              placeholder="—"
              value={draft[key]}
              error={errors[key]}
              onChange={(event) => setDraft({ ...draft, [key]: event.target.value })}
            />
          ))}
        </div>
        {formError ? <InlineAlert tone="danger">{formError}</InlineAlert> : null}
      </form>
    </Dialog>
  );
}

/** Manual entry of one account's follower count on a given day. */
export function FollowerCountDialog({
  accounts,
  initialAccountId,
  snapshots,
  today,
  onClose,
}: {
  accounts: readonly Account[];
  initialAccountId: string | null;
  snapshots: readonly FollowerSnapshot[];
  today: string;
  onClose: () => void;
}): React.JSX.Element {
  const record = useRecordFollowers();
  const toast = useToast();
  const [selectedId, setSelectedId] = useState(initialAccountId ?? accounts[0]?.id ?? "");
  const [followers, setFollowers] = useState("");
  const [day, setDay] = useState(today);
  const [fieldError, setFieldError] = useState("");
  const [formError, setFormError] = useState("");
  const account = accounts.find((a) => a.id === selectedId) ?? null;
  const latest = account ? followersAt(snapshots, account, today) : null;
  const formId = "follower-count";

  function submit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (!account) {
      setFormError("Choose an account.");
      return;
    }
    const parsed = parseCount(followers);
    if (parsed === null || parsed === "invalid") {
      setFieldError("Enter the follower count as a whole number.");
      return;
    }
    if (!day || day > today) {
      setFieldError("");
      setFormError("Pick a date on or before today.");
      return;
    }
    setFieldError("");
    setFormError("");
    record.mutate(
      { profileId: account.profile.id, platform: account.platform, followers: parsed, capturedOn: day },
      {
        onSuccess: () => {
          toast.show({ message: "Follower count saved", tone: "success" });
          onClose();
        },
        onError: (error) => setFormError(error.message),
      },
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => (open ? undefined : onClose())}
      title="Add follower count"
      description="Copy today's follower total from the account's profile or analytics page. One count per account per day; saving again on the same day replaces it."
      actions={
        <>
          <Button variant="secondary" onClick={onClose} disabled={record.isPending}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form={formId} loading={record.isPending} loadingLabel="Saving…">
            Save count
          </Button>
        </>
      }
    >
      <form id={formId} className={styles.entryForm} onSubmit={submit} noValidate>
        <Select
          label="Account"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          options={accounts.map((a) => ({
            value: a.id,
            label: `${accountLabel(a)} · ${platformName(a.platform)}`,
          }))}
        />
        <Input
          label="Followers"
          inputMode="numeric"
          autoComplete="off"
          value={followers}
          error={fieldError || undefined}
          hint={
            latest
              ? `Last entered: ${latest.followers.toLocaleString("en-US")} on ${formatShortDate(latest.capturedOn)}`
              : "No count entered yet for this account."
          }
          onChange={(event) => setFollowers(event.target.value)}
        />
        <Input type="date" label="As of" value={day} max={today} onChange={(event) => setDay(event.target.value)} />
        {formError ? <InlineAlert tone="danger">{formError}</InlineAlert> : null}
      </form>
    </Dialog>
  );
}
