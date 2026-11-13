"use client";

import { ExternalLink, Info, Pencil, Trash2, UserPlus, Users } from "lucide-react";
import { useState } from "react";

import { useArchiveProfile, useProfiles } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { Card } from "@/shared/peacock/data";
import { Button, cx, Dialog, EmptyState, InlineAlert, Tabs, useToast, type TabItem } from "@/shared/peacock/ui";

import { ProfileDialog } from "./profile-dialog";
import { MemberEntity, SkeletonRows, TableHead } from "./table-parts";
import styles from "./settings.module.css";

type SettingsTab = "accounts";

const PANEL_ID = "settings-panel";
const TABS: Array<{ value: SettingsTab; label: string; short: string }> = [
  { value: "accounts", label: "Accounts", short: "Accounts" },
];

const COLUMNS = [
  { key: "account", label: "Account" },
  { key: "linkedin", label: "LinkedIn" },
  { key: "x", label: "X" },
  { key: "action", label: <span className="sr-only">Actions</span> },
];

const V1_LINE =
  "Accounts aren't connected by login: each person posts from their own browser session through share links, and analytics are entered by hand.";

function kindLabel(kind: Profile["kind"]): string {
  switch (kind) {
    case "person":
      return "Person";
    case "company":
      return "Company";
  }
}

/** "linkedin.com/in/ada" from a stored URL. */
function linkedInLabel(url: string): string {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, "")}${parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    return url;
  }
}

/** Settings: the accounts (profiles) that posts belong to. */
export function SettingsPage(): React.JSX.Element {
  const toast = useToast();
  const profiles = useProfiles();
  const archive = useArchiveProfile();
  const [editing, setEditing] = useState<{ profile: Profile | null } | null>(null);
  const [removing, setRemoving] = useState<Profile | null>(null);
  const [tab, setTab] = useState<SettingsTab>("accounts");

  const items: TabItem<SettingsTab>[] = TABS.map((t) => ({ value: t.value, label: t.label, panelId: PANEL_ID }));
  const list = profiles.data;
  const note = list
    ? `${list.length} ${list.length === 1 ? "account" : "accounts"} post from this workspace. Each has a LinkedIn profile, an X handle, or both.`
    : null;

  function confirmRemove(): void {
    if (!removing) return;
    const target = removing;
    archive.mutate(target.id, {
      onSuccess: () => {
        setRemoving(null);
        toast.show({ message: `${target.name} removed.` });
      },
    });
  }

  return (
    <div className={styles.page}>
      <h1 className="sr-only">Settings</h1>
      <div className={styles.tabBar}>
        <Tabs className={styles.tabs} label="Settings sections" items={items} value={tab} onChange={setTab} />
        <div className={styles.pills} role="tablist" aria-label="Settings sections">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={t.value === tab}
              aria-controls={PANEL_ID}
              className={styles.pill}
              onClick={() => setTab(t.value)}
            >
              {t.short}
            </button>
          ))}
        </div>
        <div className={styles.tabAction}>
          <Button
            variant="primary"
            icon={<UserPlus size={15} strokeWidth={1.75} />}
            onClick={() => setEditing({ profile: null })}
          >
            Add account
          </Button>
        </div>
      </div>

      <div id={PANEL_ID} role="tabpanel" aria-label="Accounts" tabIndex={0} className={styles.panel}>
        {note ? <p className={styles.note}>{note}</p> : null}
        <Card padding="none" className={styles.card} aria-label="Accounts">
          {profiles.isPending ? (
            <SkeletonRows />
          ) : profiles.isError ? (
            <div className={styles.empty}>
              <InlineAlert
                tone="danger"
                action={
                  <Button size="sm" loading={profiles.isFetching} onClick={() => void profiles.refetch()}>
                    Try again
                  </Button>
                }
              >
                Accounts didn&apos;t load. {profiles.error.message}
              </InlineAlert>
            </div>
          ) : profiles.data.length === 0 ? (
            <EmptyState
              className={styles.empty}
              icon={<Users size={16} strokeWidth={1.75} />}
              title="No accounts yet"
              body="Add the people and brands you post for. Each needs a LinkedIn profile, an X handle, or both."
              action={
                <Button icon={<UserPlus size={15} strokeWidth={1.75} />} onClick={() => setEditing({ profile: null })}>
                  Add account
                </Button>
              }
            />
          ) : (
            <div role="table" aria-label="Accounts" className={styles.table}>
              <TableHead gridClass={styles.profilesGrid} columns={COLUMNS} />
              <div role="rowgroup">
                {profiles.data.map((profile) => (
                  <div key={profile.id} role="row" className={cx(styles.grid, styles.profilesGrid, styles.row)}>
                    <span role="cell" className={styles.cell}>
                      <MemberEntity
                        name={profile.name}
                        subline={kindLabel(profile.kind)}
                        {...(profile.avatarUrl ? { pictureUrl: profile.avatarUrl } : {})}
                        mobileMeta={
                          [profile.linkedinUrl ? linkedInLabel(profile.linkedinUrl) : null, profile.xHandle ? `@${profile.xHandle}` : null]
                            .filter(Boolean)
                            .join(" · ") || null
                        }
                      />
                    </span>
                    <span role="cell" className={cx(styles.cell, styles.syncCell)}>
                      {profile.linkedinUrl ? (
                        <a className={styles.accountLink} href={profile.linkedinUrl} target="_blank" rel="noreferrer">
                          <span className={styles.entityName}>{linkedInLabel(profile.linkedinUrl)}</span>
                          <ExternalLink size={12} strokeWidth={1.75} aria-hidden />
                        </a>
                      ) : (
                        <span className={styles.muted}>Not added</span>
                      )}
                    </span>
                    <span role="cell" className={cx(styles.cell, styles.syncCell)}>
                      {profile.xHandle ? (
                        <a
                          className={styles.accountLink}
                          href={`https://x.com/${profile.xHandle}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          <span className={styles.entityName}>@{profile.xHandle}</span>
                          <ExternalLink size={12} strokeWidth={1.75} aria-hidden />
                        </a>
                      ) : (
                        <span className={styles.muted}>Not added</span>
                      )}
                    </span>
                    <span role="cell" className={cx(styles.cell, styles.endCell, styles.rowActions)}>
                      <Button
                        size="sm"
                        icon={<Pencil size={13} strokeWidth={1.75} />}
                        aria-label={`Edit ${profile.name}`}
                        onClick={() => setEditing({ profile })}
                      >
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive-secondary"
                        icon={<Trash2 size={13} strokeWidth={1.75} />}
                        aria-label={`Remove ${profile.name}`}
                        onClick={() => {
                          archive.reset();
                          setRemoving(profile);
                        }}
                      >
                        Remove
                      </Button>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>
        <p className={styles.shield}>
          <Info size={13} strokeWidth={1.75} aria-hidden />
          {V1_LINE}
        </p>
      </div>

      <ProfileDialog
        open={editing !== null}
        profile={editing?.profile ?? null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSaved={(saved, created) =>
          toast.show({ message: created ? `${saved.name} added.` : `${saved.name} saved.`, tone: "success" })
        }
      />

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open && !archive.isPending) setRemoving(null);
        }}
        title={removing ? `Remove ${removing.name}?` : ""}
        description="It leaves the account selector and can't be picked for new posts. Its existing posts and analytics stay."
        actions={
          <>
            <Button disabled={archive.isPending} onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={archive.isPending} loadingLabel="Removing…" onClick={confirmRemove}>
              Remove
            </Button>
          </>
        }
      >
        {archive.isError ? <InlineAlert tone="danger">{archive.error.message}</InlineAlert> : null}
      </Dialog>
    </div>
  );
}
