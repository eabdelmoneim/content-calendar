"use client";

import { useQueryClient } from "@tanstack/react-query";
import { CalendarClock, CircleDot, ListTodo, Paperclip, Pencil, Play, Plus, RotateCcw, SearchX, Trash2, Upload, UserRound } from "lucide-react";
import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DragEvent,
  type FormEvent,
  type KeyboardEvent,
} from "react";

import { useAssetUploads } from "@/features/assets/use-asset-uploads";
import {
  keys,
  useAddAssetTodo,
  useAssets,
  useAssetTodos,
  useProfiles,
  useRemoveAssetTodo,
  useSession,
  useUpdateAssetTodo,
  type AssetTodoChanges,
} from "@/lib/api";
import { MAX_ASSIGNEE_NAME, MAX_TODO_ATTACHMENTS, MAX_TODO_TITLE, type Asset, type AssetTodo } from "@/lib/types";
import {
  Avatar,
  Button,
  Checkbox,
  cx,
  Dialog,
  EmptyState,
  ICON_STROKE,
  IconButton,
  InlineAlert,
  Input,
  Segmented,
  Select,
  Skeleton,
  useToast,
} from "@/shared/peacock/ui";

import {
  assigneeSuggestions,
  dueState,
  EVERYONE,
  filterByAssignee,
  filterTodos,
  formatDueDay,
  localDayKey,
  sortTodos,
  type TodoFilter,
  todoState,
  UNASSIGNED,
} from "./todo-model";
import { AttachmentStrip, dragHasFiles, useFilePicker } from "./todo-attachments";
import styles from "./todo.module.css";

const ICON = { size: 15, strokeWidth: ICON_STROKE } as const;
const subscribeNever = () => () => {};

/**
 * To-Do: what the team plans to make next, who is making it, an
 * optional due date and a checkbox that crosses it out when done. Shared by
 * the whole workspace, like the library, so people can hold each other to it.
 * Files (the finished video or image) can be attached to an item; they are
 * uploaded to the Assets library and shown on the to-do.
 */
export function TodoPanel(): React.JSX.Element {
  const todosQuery = useAssetTodos();
  const add = useAddAssetTodo();
  const update = useUpdateAssetTodo();
  const remove = useRemoveAssetTodo();
  const toast = useToast();
  const client = useQueryClient();
  const assetsQuery = useAssets();
  const assetsById = useMemo(
    () => new Map((assetsQuery.data ?? []).map((asset) => [asset.id, asset])),
    [assetsQuery.data],
  );
  const session = useSession();
  const profiles = useProfiles();
  const peopleListId = useId();
  // The device's calendar day; null on the server so hydration stays stable.
  const today = useSyncExternalStore(subscribeNever, () => localDayKey(), () => null);

  const [title, setTitle] = useState("");
  const [dueOn, setDueOn] = useState("");
  const [assignee, setAssignee] = useState("");
  const [filter, setFilter] = useState<TodoFilter>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>(EVERYONE);
  const [removing, setRemoving] = useState<AssetTodo | null>(null);
  // Files uploaded for the item being typed; attached when it's added.
  const [staged, setStaged] = useState<string[]>([]);
  const newUploads = useAssetUploads();
  const newUploading = newUploads.uploads.some((entry) => entry.phase === "uploading");
  useUploadProblems(newUploads.batchError, newUploads.clearBatchError);

  async function stageFiles(files: File[]): Promise<void> {
    const room = MAX_TODO_ATTACHMENTS - staged.length;
    if (room <= 0) {
      toast.show({ message: `A to-do can hold up to ${MAX_TODO_ATTACHMENTS} files.`, tone: "danger" });
      return;
    }
    const uploaded = await newUploads.start(files.slice(0, room));
    if (uploaded.length > 0) setStaged((current) => [...current, ...uploaded.map((asset) => asset.id)]);
  }
  const newPicker = useFilePicker((files) => void stageFiles(files));

  /** Adds freshly uploaded files to an item, reading its latest attachments. */
  function attach(todoId: string, uploaded: Asset[]): void {
    if (uploaded.length === 0) return;
    const latest = client.getQueryData<AssetTodo[]>(keys.todos)?.find((todo) => todo.id === todoId);
    if (!latest) return;
    const ids = [...latest.assetIds, ...uploaded.map((asset) => asset.id).filter((id) => !latest.assetIds.includes(id))];
    change(latest, { assetIds: ids.slice(0, MAX_TODO_ATTACHMENTS) });
    if (ids.length > MAX_TODO_ATTACHMENTS) {
      toast.show({
        message: `A to-do can hold up to ${MAX_TODO_ATTACHMENTS} files; the rest are in Assets.`,
        tone: "danger",
      });
    }
  }

  const viewerName = session.data?.user.name ?? null;
  const people = useMemo(
    () =>
      assigneeSuggestions(
        todosQuery.data ?? [],
        viewerName,
        (profiles.data ?? []).filter((profile) => profile.kind === "person").map((profile) => profile.name),
      ),
    [todosQuery.data, viewerName, profiles.data],
  );
  const sorted = useMemo(() => sortTodos(todosQuery.data ?? []), [todosQuery.data]);
  const all = useMemo(() => filterByAssignee(sorted, assigneeFilter), [sorted, assigneeFilter]);
  const visible = useMemo(() => filterTodos(all, filter), [all, filter]);
  const counts = { not_started: 0, in_progress: 0, done: 0 };
  for (const todo of all) counts[todoState(todo)] += 1;
  const assigneeOptions = [
    { value: EVERYONE, label: "Everyone" },
    ...people.map((name) => ({ value: name, label: name === viewerName ? `${name} (me)` : name })),
    { value: UNASSIGNED, label: "Unassigned" },
  ];

  function submit(event: FormEvent): void {
    event.preventDefault();
    const text = title.trim();
    if (text.length === 0) return;
    const due = dueOn || null;
    const who = assignee.trim() || null;
    const files = staged;
    // Clear at once so the next item can be typed; put it back if the save fails.
    // The assignee stays, since people often add several items for one person.
    setTitle("");
    setDueOn("");
    setStaged([]);
    add.mutate(
      { title: text, dueOn: due, assigneeName: who, ...(files.length > 0 ? { assetIds: files } : {}) },
      {
        onError: () => {
          setTitle((current) => (current === "" ? text : current));
          setDueOn((current) => (current === "" ? (due ?? "") : current));
          setStaged((current) => (current.length === 0 ? files : current));
        },
      },
    );
  }

  function change(todo: AssetTodo, changes: AssetTodoChanges): void {
    update.mutate(
      { id: todo.id, changes },
      { onError: (error) => toast.show({ message: error.message, tone: "danger" }) },
    );
  }

  function confirmRemove(): void {
    if (!removing) return;
    const target = removing;
    remove.mutate(target.id, {
      onSuccess: () => {
        setRemoving(null);
        toast.show({ message: `Removed "${target.title}".` });
      },
    });
  }

  return (
    <div className={styles.panel}>
      <form className={styles.addRow} onSubmit={submit} aria-label="Add a to-do">
        <Input
          aria-label="What do you plan to make?"
          placeholder="What do you plan to make? e.g. 30s launch teaser for X"
          fieldClassName={styles.addTitle}
          value={title}
          maxLength={MAX_TODO_TITLE}
          onChange={(event) => setTitle(event.target.value)}
        />
        <Input
          aria-label="Assign to"
          placeholder="Assign to"
          icon={<UserRound size={14} strokeWidth={ICON_STROKE} />}
          list={peopleListId}
          autoComplete="off"
          fieldClassName={styles.addAssignee}
          value={assignee}
          maxLength={MAX_ASSIGNEE_NAME}
          onChange={(event) => setAssignee(event.target.value)}
        />
        <Input
          type="date"
          aria-label="Due date"
          title="Due date"
          fieldClassName={styles.addDate}
          value={dueOn}
          onChange={(event) => setDueOn(event.target.value)}
        />
        <IconButton
          aria-label="Attach files"
          title="Attach the video or image (it also goes into Assets)"
          icon={<Paperclip {...ICON} />}
          onClick={newPicker.open}
        />
        {newPicker.input}
        <Button
          type="submit"
          variant="primary"
          icon={<Plus {...ICON} />}
          disabled={title.trim().length === 0 || newUploading}
          title={newUploading ? "Wait for the files to finish uploading" : undefined}
        >
          Add
        </Button>
        <datalist id={peopleListId}>
          {/* Suggestions come from cached client data, so they wait for hydration. */}
          {today === null ? null : people.map((name) => <option key={name} value={name} />)}
        </datalist>
      </form>
      {staged.length > 0 || newUploads.uploads.length > 0 ? (
        <div className={styles.stagedRow}>
          <AttachmentStrip
            assetIds={staged}
            assetsById={assetsById}
            assetsLoading={assetsQuery.isPending}
            uploads={newUploads.uploads}
            onRemove={(id) => setStaged((current) => current.filter((existing) => existing !== id))}
            onDismissUpload={newUploads.dismiss}
          />
        </div>
      ) : null}
      {add.isError ? (
        <div className={styles.alertRow}>
          <InlineAlert tone="danger">{add.error.message}</InlineAlert>
        </div>
      ) : null}

      <div className={styles.toolbar}>
        <Segmented
          label="Show to-dos"
          size="compact"
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: `All ${all.length}` },
            { value: "not_started", label: `Not started ${counts.not_started}` },
            { value: "in_progress", label: `In progress ${counts.in_progress}` },
            { value: "done", label: `Done ${counts.done}` },
          ]}
        />
        <Select
          aria-label="Assigned to"
          fieldClassName={styles.assigneeFilter}
          options={assigneeOptions}
          value={assigneeFilter}
          onChange={(event) => setAssigneeFilter(event.target.value)}
        />
      </div>

      <div className={styles.scroll}>
        {todosQuery.isPending ? (
          <div className={styles.list} aria-busy="true" aria-label="Loading to-dos">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} height={44} radius="md" />
            ))}
          </div>
        ) : todosQuery.isError ? (
          <EmptyState
            icon={<ListTodo />}
            headingLevel={2}
            title="The to-do list didn't load"
            body={todosQuery.error.message}
            action={
              <Button
                icon={<RotateCcw {...ICON} />}
                loading={todosQuery.isFetching}
                loadingLabel="Retrying…"
                onClick={() => void todosQuery.refetch()}
              >
                Try again
              </Button>
            }
          />
        ) : sorted.length === 0 ? (
          <EmptyState
            icon={<ListTodo />}
            headingLevel={2}
            title="Nothing planned yet"
            body="Add the videos, images and clips you plan to make, who's making each one and the day it should be done by. Tick them off when they're finished."
          />
        ) : all.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title={assigneeFilter === UNASSIGNED ? "Everything is assigned" : `Nothing assigned to ${assigneeFilter}`}
            body="Pick someone else, or show everyone's items."
            action={<Button onClick={() => setAssigneeFilter(EVERYONE)}>Show everyone</Button>}
          />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<SearchX />}
            title={
              filter === "done"
                ? "Nothing finished yet"
                : filter === "in_progress"
                  ? "Nothing in progress"
                  : "Everything's started"
            }
            body={
              filter === "done"
                ? "Ticked items show up here, crossed out."
                : filter === "in_progress"
                  ? "Press Start on a to-do when you begin working on it, so everyone can see."
                  : "Every open item is in progress or done."
            }
            action={<Button onClick={() => setFilter("all")}>Show all</Button>}
          />
        ) : (
          <ul className={styles.list} aria-label="To-dos">
            {visible.map((todo) => (
              <li key={todo.id}>
                <TodoRow
                  todo={todo}
                  today={today}
                  peopleListId={peopleListId}
                  assetsById={assetsById}
                  assetsLoading={assetsQuery.isPending}
                  onAttach={(uploaded) => attach(todo.id, uploaded)}
                  onChange={(changes) => change(todo, changes)}
                  onRemove={() => {
                    remove.reset();
                    setRemoving(todo);
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open && !remove.isPending) setRemoving(null);
        }}
        title="Remove this to-do?"
        description={removing ? `"${removing.title}" leaves the list for everyone.` : undefined}
        actions={
          <>
            <Button disabled={remove.isPending} onClick={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button variant="danger" loading={remove.isPending} loadingLabel="Removing…" onClick={confirmRemove}>
              Remove
            </Button>
          </>
        }
      >
        {remove.isError ? <InlineAlert tone="danger">{remove.error.message}</InlineAlert> : null}
      </Dialog>
    </div>
  );
}

/** Upload problems (wrong type, too big) as a toast, then clear them. */
function useUploadProblems(problem: string | null, clear: () => void): void {
  const toast = useToast();
  useEffect(() => {
    if (!problem) return;
    toast.show({ message: problem, tone: "danger" });
    clear();
  }, [problem, clear, toast]);
}

function TodoRow({
  todo,
  today,
  peopleListId,
  assetsById,
  assetsLoading,
  onAttach,
  onChange,
  onRemove,
}: {
  todo: AssetTodo;
  today: string | null;
  peopleListId: string;
  assetsById: ReadonlyMap<string, Asset>;
  assetsLoading: boolean;
  onAttach: (uploaded: Asset[]) => void;
  onChange: (changes: AssetTodoChanges) => void;
  onRemove: () => void;
}): React.JSX.Element {
  const uploads = useAssetUploads();
  useUploadProblems(uploads.batchError, uploads.clearBatchError);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  async function upload(files: File[]): Promise<void> {
    onAttach(await uploads.start(files));
  }
  const picker = useFilePicker((files) => void upload(files));

  const dropHandlers = {
    onDragEnter: (event: DragEvent<HTMLDivElement>) => {
      if (!dragHasFiles(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setDragging(true);
    },
    onDragOver: (event: DragEvent<HTMLDivElement>) => {
      if (!dragHasFiles(event)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    },
    onDragLeave: (event: DragEvent<HTMLDivElement>) => {
      if (!dragHasFiles(event)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    },
    onDrop: (event: DragEvent<HTMLDivElement>) => {
      if (!dragHasFiles(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      void upload(Array.from(event.dataTransfer.files));
    },
  };

  const state = todoState(todo);
  const done = state === "done";
  const due = dueState(todo, today);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(todo.title);
  const [editingDate, setEditingDate] = useState(false);
  const [editingAssignee, setEditingAssignee] = useState(false);

  function startEdit(): void {
    setDraft(todo.title);
    setEditing(true);
  }

  function commit(): void {
    setEditing(false);
    const text = draft.trim();
    if (text.length > 0 && text !== todo.title) onChange({ title: text });
  }

  function onEditKey(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Enter") {
      event.preventDefault();
      commit();
    } else if (event.key === "Escape") {
      event.preventDefault();
      setEditing(false);
    }
  }

  const meta = done
    ? `Done${todo.completedByName ? ` by ${todo.completedByName}` : ""}`
    : state === "in_progress"
      ? `Started by ${todo.startedByName ?? "someone"}`
      : todo.createdByName
        ? `Added by ${todo.createdByName}`
        : null;

  return (
    <div
      className={cx(
        styles.row,
        done && styles.rowDone,
        state === "in_progress" && styles.rowInProgress,
        dragging && styles.rowDropping,
      )}
      data-todo={todo.id}
      {...dropHandlers}
    >
      <Checkbox
        checked={done}
        aria-label={done ? `Mark "${todo.title}" as not done` : `Mark "${todo.title}" as done`}
        onCheckedChange={(checked) => onChange({ done: checked })}
        className={styles.check}
      />
      <div className={styles.text}>
        {editing ? (
          <Input
            autoFocus
            aria-label="Edit to-do"
            value={draft}
            maxLength={MAX_TODO_TITLE}
            onChange={(event) => setDraft(event.target.value)}
            onBlur={commit}
            onKeyDown={onEditKey}
          />
        ) : (
          <span className={styles.title} onDoubleClick={done ? undefined : startEdit}>
            {todo.title}
          </span>
        )}
        <span className={styles.metaRow}>
          {done ? null : (
            <button
              type="button"
              className={cx(styles.statusButton, state === "in_progress" && styles.inProgress)}
              aria-pressed={state === "in_progress"}
              aria-label={
                state === "in_progress"
                  ? `"${todo.title}" is in progress. Mark as not started`
                  : `Mark "${todo.title}" as in progress`
              }
              title={state === "in_progress" ? "Mark as not started" : "Mark as in progress"}
              onClick={() => onChange({ inProgress: state !== "in_progress" })}
            >
              {state === "in_progress" ? (
                <CircleDot size={12} strokeWidth={ICON_STROKE} aria-hidden />
              ) : (
                <Play size={11} strokeWidth={ICON_STROKE} aria-hidden />
              )}
              {state === "in_progress" ? "In progress" : "Start"}
            </button>
          )}
          {meta ? <span className={styles.meta}>{meta}</span> : null}
        </span>
      </div>

      <div className={styles.assignee}>
        {editingAssignee ? (
          <Input
            autoFocus
            aria-label={`Assign "${todo.title}" to`}
            placeholder="Name, or empty"
            list={peopleListId}
            autoComplete="off"
            fieldClassName={styles.assigneeEdit}
            defaultValue={todo.assigneeName ?? ""}
            maxLength={MAX_ASSIGNEE_NAME}
            onBlur={(event) => {
              setEditingAssignee(false);
              const value = event.target.value.trim() || null;
              if (value !== todo.assigneeName) onChange({ assigneeName: value });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") setEditingAssignee(false);
            }}
          />
        ) : (
          <button
            type="button"
            className={cx(styles.assigneeButton, todo.assigneeName === null && styles.unassigned)}
            aria-label={todo.assigneeName ? `Assigned to ${todo.assigneeName}. Reassign` : "Assign someone"}
            onClick={() => setEditingAssignee(true)}
          >
            {todo.assigneeName ? (
              <Avatar name={todo.assigneeName} size={20} decorative />
            ) : (
              <UserRound size={13} strokeWidth={ICON_STROKE} aria-hidden />
            )}
            <span className={styles.assigneeName}>{todo.assigneeName ?? "Unassigned"}</span>
          </button>
        )}
      </div>

      <div className={styles.due}>
        {editingDate ? (
          <Input
            type="date"
            autoFocus
            aria-label={`Due date for "${todo.title}"`}
            fieldClassName={styles.dateEdit}
            defaultValue={todo.dueOn ?? ""}
            onBlur={(event) => {
              setEditingDate(false);
              const value = event.target.value || null;
              if (value !== todo.dueOn) onChange({ dueOn: value });
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
              if (event.key === "Escape") setEditingDate(false);
            }}
          />
        ) : (
          <button
            type="button"
            className={cx(
              styles.dueButton,
              due === "overdue" && styles.overdue,
              due === "today" && styles.dueToday,
              todo.dueOn === null && styles.noDue,
            )}
            aria-label={todo.dueOn ? `Due ${todo.dueOn}. Change due date` : "Set a due date"}
            onClick={() => setEditingDate(true)}
          >
            <CalendarClock size={13} strokeWidth={ICON_STROKE} aria-hidden />
            {todo.dueOn
              ? `${due === "overdue" ? "Overdue · " : due === "today" ? "Due today · " : "Due "}${formatDueDay(todo.dueOn, today)}`
              : "No due date"}
          </button>
        )}
      </div>

      <div className={styles.actions}>
        <IconButton
          aria-label={`Attach files to "${todo.title}"`}
          title="Attach files (or drop them on this to-do)"
          size="sm"
          icon={<Paperclip {...ICON} />}
          onClick={picker.open}
        />
        {picker.input}
        {!done ? <IconButton aria-label={`Edit "${todo.title}"`} size="sm" icon={<Pencil {...ICON} />} onClick={startEdit} /> : null}
        <IconButton aria-label={`Remove "${todo.title}"`} size="sm" icon={<Trash2 {...ICON} />} onClick={onRemove} />
      </div>

      {todo.assetIds.length > 0 || uploads.uploads.length > 0 ? (
        <div className={styles.rowAttachments}>
          <AttachmentStrip
            assetIds={todo.assetIds}
            assetsById={assetsById}
            assetsLoading={assetsLoading}
            uploads={uploads.uploads}
            onRemove={(id) => onChange({ assetIds: todo.assetIds.filter((existing) => existing !== id) })}
            onDismissUpload={uploads.dismiss}
          />
        </div>
      ) : null}

      {dragging ? (
        <div className={styles.dropHint} aria-hidden>
          <Upload size={14} strokeWidth={ICON_STROKE} />
          Drop to attach to this to-do
        </div>
      ) : null}
    </div>
  );
}
