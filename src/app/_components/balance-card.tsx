import { recordPayment } from "@/app/actions";
import { Input } from "@/components/ui/input";
import type {
  CourseEarningsRow,
  PaymentRow,
  StudentBalanceRow,
} from "@/lib/database.types";
import { formatClassDate } from "@/lib/format";
import { formatPaise } from "@/lib/money";
import { cn } from "@/lib/utils";

import { SubmitButton } from "./submit-button";
import { Section } from "./ui";

export function BalanceCard({
  balance,
  earnings,
  payments,
}: {
  balance: StudentBalanceRow;
  earnings: CourseEarningsRow[];
  payments: PaymentRow[];
}) {
  const settled = balance.owed_paise <= 0;

  return (
    <Section title="Balance">
      <div className="flex items-baseline justify-between gap-3">
        <p
          className={cn(
            "text-3xl font-semibold tabular-nums",
            settled && "text-muted-foreground",
          )}
        >
          {formatPaise(balance.owed_paise)}
        </p>
        <p className="text-right text-sm text-muted-foreground">
          {balance.confirmed_classes} classes logged
          <br />
          {formatPaise(balance.earned_paise)} earned all time
        </p>
      </div>

      {earnings.length > 1 && (
        <ul className="mt-3 space-y-1 border-t pt-3 text-sm text-muted-foreground">
          {earnings.map((course) => (
            <li key={course.course_id} className="flex justify-between gap-3">
              <span>
                {course.name}
                <span className="opacity-60"> · {course.confirmed_classes}</span>
              </span>
              <span className="tabular-nums">
                {formatPaise(course.earned_paise)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form action={recordPayment} className="mt-4 flex gap-2">
        <Input
          name="rupees"
          inputMode="decimal"
          placeholder="Amount received"
          aria-label="Payment amount in rupees"
          className="h-10"
          required
        />
        <SubmitButton className="h-10 px-4" pendingLabel="Saving">
          Record
        </SubmitButton>
      </form>

      {payments.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-muted-foreground">
          {payments.slice(0, 4).map((payment) => (
            <li key={payment.id} className="flex justify-between gap-3">
              <span>{formatClassDate(payment.date)}</span>
              <span className="tabular-nums">
                {formatPaise(payment.amount_paise)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}
