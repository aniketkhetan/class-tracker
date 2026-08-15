import { addAdHocClass } from "@/app/actions";

import { buttonStyles, Card, inputStyles } from "./ui";

export function AddClass({ today }: { today: string }) {
  return (
    <Card title="Extra class">
      <form action={addAdHocClass} className="flex gap-2">
        <input
          className={inputStyles}
          type="date"
          name="date"
          defaultValue={today}
          max={today}
          aria-label="Date of the extra class"
        />
        <button className={buttonStyles.primary} type="submit">
          Add
        </button>
      </form>
    </Card>
  );
}
