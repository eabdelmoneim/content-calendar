"use client";

import { useRef, useState } from "react";

import { ApiRequestError, useSaveProfile, type ProfileFields } from "@/lib/api";
import type { Profile } from "@/lib/types";
import { Button, Dialog, InlineAlert, Input } from "@/shared/peacock/ui";

import styles from "./settings.module.css";

const FORM_ID = "settings-profile-form";

type Kind = Profile["kind"];
type FieldKey = "name" | "linkedinUrl" | "xHandle" | "avatarUrl";

const KIND_OPTIONS: Array<{ value: Kind; label: string; description: string }> = [
  { value: "person", label: "Person", description: "Someone who posts as themselves." },
  { value: "company", label: "Company", description: "A brand or company page." },
];

/** Which field a server validation error belongs to; null shows it above the form. */
export function fieldForError(error: ApiRequestError): FieldKey[] {
  switch (error.code) {
    case "name_required":
      return ["name"];
    case "bad_x_handle":
      return ["xHandle"];
    case "bad_url":
      return error.message.startsWith("Avatar") ? ["avatarUrl"] : ["linkedinUrl"];
    case "account_required":
      return ["linkedinUrl", "xHandle"];
    default:
      return [];
  }
}

const blank = (value: FormDataEntryValue | null): string | null => {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : null;
};

/**
 * Add or edit an account that posts. The server validates and normalizes
 * (strips "@", checks URLs); its messages show next to the field they're about.
 */
export function ProfileDialog({
  open,
  profile,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  /** null adds a new account. */
  profile: Profile | null;
  onOpenChange: (open: boolean) => void;
  onSaved: (profile: Profile, created: boolean) => void;
}): React.JSX.Element {
  const save = useSaveProfile();
  const nameRef = useRef<HTMLInputElement>(null);
  const [kind, setKind] = useState<Kind>(profile?.kind ?? "person");
  const [formKey, setFormKey] = useState(0);
  const [lastProfile, setLastProfile] = useState(profile);
  const [lastOpen, setLastOpen] = useState(open);
  // Reset the form whenever the dialog opens for a (possibly different) account.
  if (open !== lastOpen || profile !== lastProfile) {
    setLastOpen(open);
    setLastProfile(profile);
    if (open) {
      setKind(profile?.kind ?? "person");
      setFormKey((key) => key + 1);
      save.reset();
    }
  }

  const pending = save.isPending;
  const error = save.error;
  const fieldErrors = error instanceof ApiRequestError ? fieldForError(error) : [];
  const errorFor = (key: FieldKey) => (error && fieldErrors.includes(key) ? error.message : undefined);
  const formError = error && fieldErrors.length === 0 ? error.message : null;

  function close(next: boolean): void {
    if (pending) return;
    onOpenChange(next);
  }

  function submit(form: HTMLFormElement): void {
    const data = new FormData(form);
    const fields: ProfileFields = {
      name: String(data.get("name") ?? "").trim(),
      kind,
      linkedinUrl: blank(data.get("linkedinUrl")),
      xHandle: blank(data.get("xHandle")),
      avatarUrl: blank(data.get("avatarUrl")),
    };
    save.mutate(
      { id: profile?.id ?? null, fields },
      {
        onSuccess: (saved) => {
          onOpenChange(false);
          onSaved(saved, profile === null);
        },
      },
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={close}
      title={profile ? `Edit ${profile.name}` : "Add an account"}
      description="An account is one person or brand. Add a LinkedIn profile, an X handle, or both."
      initialFocusRef={nameRef}
      actions={
        <>
          <Button disabled={pending} onClick={() => close(false)}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} variant="primary" loading={pending} loadingLabel="Saving…">
            {profile ? "Save" : "Add account"}
          </Button>
        </>
      }
    >
      <form
        key={formKey}
        id={FORM_ID}
        className={styles.form}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit(event.currentTarget);
        }}
      >
        {formError ? <InlineAlert tone="danger">{formError}</InlineAlert> : null}
        <Input
          ref={nameRef}
          name="name"
          label="Name"
          placeholder="Ada Lovelace"
          defaultValue={profile?.name ?? ""}
          autoComplete="off"
          required
          disabled={pending}
          error={errorFor("name")}
        />
        <fieldset className={styles.roleGroup} disabled={pending}>
          <legend className={styles.roleLegend}>Kind</legend>
          {KIND_OPTIONS.map((option) => (
            <label key={option.value} className={styles.roleOption}>
              <input
                type="radio"
                name="kind"
                value={option.value}
                checked={kind === option.value}
                onChange={() => setKind(option.value)}
              />
              <span className={styles.roleText}>
                <span className={styles.roleName}>{option.label}</span>
                <span className={styles.roleDescription}>{option.description}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <Input
          name="linkedinUrl"
          type="url"
          inputMode="url"
          label="LinkedIn profile URL"
          placeholder="https://www.linkedin.com/in/…"
          defaultValue={profile?.linkedinUrl ?? ""}
          autoComplete="off"
          disabled={pending}
          error={errorFor("linkedinUrl")}
        />
        <Input
          name="xHandle"
          label="X handle"
          placeholder="@handle"
          defaultValue={profile?.xHandle ? `@${profile.xHandle}` : ""}
          autoComplete="off"
          disabled={pending}
          error={errorFor("xHandle")}
        />
        <Input
          name="avatarUrl"
          type="url"
          inputMode="url"
          label="Avatar image URL"
          hint="Optional. Initials are shown without one."
          placeholder="https://…"
          defaultValue={profile?.avatarUrl ?? ""}
          autoComplete="off"
          disabled={pending}
          error={errorFor("avatarUrl")}
        />
      </form>
    </Dialog>
  );
}
