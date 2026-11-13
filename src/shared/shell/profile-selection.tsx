"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { useProfiles } from "@/lib/api";
import type { Profile } from "@/lib/types";

export const MAX_SELECTED_PROFILES = 50;
const STORAGE_KEY = "content-calendar-profile-selection";

export type ProfileSelectionMember = {
  memberId: string;
  name: string;
  profileId?: string;
  profilePictureUrl?: string;
  /** LinkedIn: "connected" means the account is added to the calendar. */
  health: { status: "connected" | "not_connected"; label: string };
  xStatus?: "connected";
  profileUnavailableReason?: string;
  profile: Profile;
};

export type ProfileSelectionValue = {
  members: readonly ProfileSelectionMember[];
  selectedProfileIds: readonly string[];
  isSelected: (profileId: string) => boolean;
  toggleProfile: (profileId: string) => void;
  selectAllProfiles?: () => void;
  /** Show just this account (one click instead of unticking the rest). */
  selectOnlyProfile?: (profileId: string) => void;
  loading: boolean;
  hasScope: boolean;
};

function toMember(profile: Profile): ProfileSelectionMember {
  return {
    memberId: profile.id,
    name: profile.name,
    profileId: profile.id,
    ...(profile.avatarUrl ? { profilePictureUrl: profile.avatarUrl } : {}),
    health: profile.linkedinUrl
      ? { status: "connected", label: "Added" }
      : { status: "not_connected", label: "Not added" },
    ...(profile.xHandle ? { xStatus: "connected" as const } : {}),
    profile,
  };
}

function readStored(): string[] | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : null;
  } catch {
    return null;
  }
}

const Context = createContext<ProfileSelectionValue | null>(null);

/**
 * Which accounts every screen shows (Peacock's top-bar selector). Defaults
 * to everyone; the choice is remembered in this browser. New accounts are
 * selected automatically when the stored choice was "everyone".
 */
export function ProfileSelectionProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const profiles = useProfiles();
  const [chosen, setChosen] = useState<string[] | null>(null);

  useEffect(() => {
    // Browser-only storage is read after mount to keep hydration stable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChosen(readStored());
  }, []);

  const members = useMemo(() => (profiles.data ?? []).map(toMember), [profiles.data]);
  const available = useMemo(() => members.map((m) => m.memberId), [members]);
  const selectedProfileIds = useMemo(() => {
    const kept = chosen?.filter((id) => available.includes(id)) ?? [];
    return kept.length > 0 ? kept : available;
  }, [chosen, available]);

  const persist = useCallback((next: string[] | null) => {
    setChosen(next);
    try {
      if (next) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      else window.localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* private mode: selection lasts for this tab only */
    }
  }, []);

  const value = useMemo<ProfileSelectionValue>(
    () => ({
      members,
      selectedProfileIds,
      isSelected: (id) => selectedProfileIds.includes(id),
      toggleProfile: (id) => {
        const on = selectedProfileIds.includes(id);
        if (on && selectedProfileIds.length <= 1) return;
        const next = on ? selectedProfileIds.filter((x) => x !== id) : [...selectedProfileIds, id];
        persist(next.length === available.length ? null : next);
      },
      selectAllProfiles: () => persist(null),
      selectOnlyProfile: (id) => persist(available.length === 1 ? null : [id]),
      loading: profiles.isPending,
      hasScope: true,
    }),
    [members, selectedProfileIds, persist, available.length, profiles.isPending],
  );

  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useProfileSelection(): ProfileSelectionValue {
  const value = useContext(Context);
  if (!value) throw new Error("useProfileSelection needs ProfileSelectionProvider");
  return value;
}
