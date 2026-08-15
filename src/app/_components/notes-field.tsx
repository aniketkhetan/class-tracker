"use client";

import { useRef, useState } from "react";

import { saveNotes } from "@/app/actions";

// Saves on blur. Never gates the confirmation, which has already happened.
export function NotesField({
  sessionId,
  notes,
}: {
  sessionId: number;
  notes: string | null;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = useState(false);

  return (
    <form action={saveNotes} ref={formRef}>
      <input type="hidden" name="sessionId" value={sessionId} />
      <textarea
        name="notes"
        defaultValue={notes ?? ""}
        rows={2}
        placeholder="How did it go?"
        onChange={() => setDirty(true)}
        onBlur={() => {
          if (!dirty) return;
          setDirty(false);
          formRef.current?.requestSubmit();
        }}
        className="mt-2 w-full resize-y rounded-lg border border-neutral-200 bg-transparent px-3 py-2 text-sm outline-none placeholder:text-neutral-400 focus:border-neutral-900 dark:border-neutral-800 dark:focus:border-neutral-300"
      />
    </form>
  );
}
