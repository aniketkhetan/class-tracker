"use client";

import { useRef, useState } from "react";

import { saveNotes } from "@/app/actions";
import { Textarea } from "@/components/ui/textarea";

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
      <Textarea
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
        className="mt-2 resize-y"
      />
    </form>
  );
}
