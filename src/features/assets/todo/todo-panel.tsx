"use client";

import { CalendarClock, ListTodo, Pencil, Plus, RotateCcw, SearchX, Trash2, UserRound } from "lucide-react";
import { useId, useMemo, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent } from "react";

import {
  useAddAssetTodo,
  useAssetTodos,
  useProfiles,
  useRemoveAssetTodo,
  useSession,
  useUpdateAssetTodo,
  type AssetTodoChanges,
} from "@/lib/api";
import { MAX_ASSIGNEE_NAME, MAX_TODO_TITLE, type AssetTodo } from "@/lib/types";
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
  UNASSIGNED,
} from "./todo-model";
import styles from "./todo.module.css";

const ICON = { size: 15, strokeWidth: ICON_STROKE } as const;
const subscribeNever = () => () => {};

/**
 * Assets › To-do: what the team plans to make next, who is making it, an
 * optional due date and a checkbox that crosses it out when done. Shared by
 * the whole workspace, like the library, so people can hold each other to it.
 */
export function TodoPanel(): React.JSX.Element {
  const todosQuery = useAssetTodos();
  const add = useAddAssetTodo();
  const update = useUpdateAssetTodo();
  const remove = useRemoveAssetTodo();
  const toast = useToast();
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
  const openCount = all.filter((todo) => todo.completedAt === null).length;
  const doneCount = all.length - openCount;
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
    // Clear at once so the next item can be typed; put it back if the save fails.
    // The assignee stays, since people often add several items for one person.
    setTitle("");
    setDueOn("");
    add.mutate(
      { title: text, dueOn: due, assigneeName: who },
      {
        onError: () => {
          setTitle((current) => (current === "" ? text : current));
          setDueOn((current) => (current === "" ? (due ?? "") : current));
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
        <Button
          type="submit"
          variant="primary"
          icon={<Plus {...ICON} />}
          disabled={title.trim().length === 0}
        >
          Add
        </Button>
        <datalist id={peopleListId}>
          {people.map((name) => (
            <option key={name} value={name} />
          ))}
        </datalist>
      </form>
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
            { value: "open", label: `To do ${openCount}` },
            { value: "done", label: `Done ${doneCount}` },
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
            title={filter === "done" ? "Nothing finished yet" : "Everything's done"}
            body={filter === "done" ? "Ticked items show up here, crossed out." : "Every item on the list is ticked off."}
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

function TodoRow({
  todo,
  today,
  peopleListId,
  onChange,
  onRemove,
}: {
  todo: AssetTodo;
  today: string | null;
  peopleListId: string;
  onChange: (changes: AssetTodoChanges) => void;
  onRemove: () => void;
}): React.JSX.Element {
  const done = todo.completedAt !== null;
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
    : todo.createdByName
      ? `Added by ${todo.createdByName}`
      : null;

  return (
    <div className={cx(styles.row, done && styles.rowDone)} data-todo={todo.id}>
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
        {meta ? <span className={styles.meta}>{meta}</span> : null}
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
        {!done ? <IconButton aria-label={`Edit "${todo.title}"`} size="sm" icon={<Pencil {...ICON} />} onClick={startEdit} /> : null}
        <IconButton aria-label={`Remove "${todo.title}"`} size="sm" icon={<Trash2 {...ICON} />} onClick={onRemove} />
      </div>
    </div>
  );
}
