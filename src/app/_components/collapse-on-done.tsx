"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";

// Closes the surrounding <details> once the action finishes, so saving returns
// you to the summary line instead of leaving the form sitting open.
//
// It sets the attribute directly rather than holding open/closed in React
// state, because <details> is uncontrolled: the server action re-renders the
// tree but React keeps the same DOM node, so `open` would otherwise survive.
export function CollapseOnDone() {
  const { pending } = useFormStatus();
  const marker = useRef<HTMLSpanElement>(null);
  const wasPending = useRef(false);

  useEffect(() => {
    if (wasPending.current && !pending) {
      marker.current?.closest("details")?.removeAttribute("open");
    }
    wasPending.current = pending;
  }, [pending]);

  return <span ref={marker} hidden />;
}
