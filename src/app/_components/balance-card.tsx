import { recordPayment } from "@/app/actions";
import { formatClassDate } from "@/lib/format";
import type {
  CourseEarningsRow,
  PaymentRow,
  StudentBalanceRow,
} from "@/lib/database.types";
import { formatPaise } from "@/lib/money";

import { buttonStyles, Card, inputStyles } from "./ui";

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
    <Card title="Balance">
      <div className="flex items-baseline justify-between gap-3">
        <p
          className={`text-3xl font-semibold tabular-nums ${
            settled ? "text-neutral-400" : ""
          }`}
        >
          {formatPaise(balance.owed_paise)}
        </p>
        <p className="text-right text-sm text-neutral-500 dark:text-neutral-400">
          {balance.confirmed_classes} classes logged
          <br />
          {formatPaise(balance.earned_paise)} earned all time
        </p>
      </div>

      {earnings.length > 1 && (
        <ul className="mt-3 space-y-1 border-t border-neutral-100 pt-3 text-sm text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
          {earnings.map((course) => (
            <li key={course.course_id} className="flex justify-between gap-3">
              <span>
                {course.name}
                <span className="text-neutral-400 dark:text-neutral-600">
                  {" "}
                  · {course.confirmed_classes}
                </span>
              </span>
              <span className="tabular-nums">
                {formatPaise(course.earned_paise)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <form action={recordPayment} className="mt-4 flex gap-2">
        <input
          className={inputStyles}
          name="rupees"
          inputMode="decimal"
          placeholder="Amount received"
          aria-label="Payment amount in rupees"
          required
        />
        <button className={buttonStyles.primary} type="submit">
          Record
        </button>
      </form>

      {payments.length > 0 && (
        <ul className="mt-4 space-y-1 text-sm text-neutral-500 dark:text-neutral-400">
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
    </Card>
  );
}
