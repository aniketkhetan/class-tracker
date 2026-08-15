import { signOut } from "./auth/actions";
import { AddClass } from "./_components/add-class";
import { BalanceCard } from "./_components/balance-card";
import { PendingQueue } from "./_components/pending-queue";
import { PushToggle } from "./_components/push-toggle";
import { SessionLog } from "./_components/session-log";
import { SetupForm } from "./_components/setup-form";
import { buttonStyles, Card } from "./_components/ui";

import { formatTime, formatWeekday } from "@/lib/format";
import { localNow } from "@/lib/occurrences";
import { getDashboard, isAllowed } from "@/lib/queries";

// Depends on the current time, so never cached.
export const dynamic = "force-dynamic";

export default async function Home() {
  if (!(await isAllowed())) {
    return (
      <Shell>
        <Card title="Not your dashboard">
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            You&rsquo;re signed in, but this account isn&rsquo;t on the
            allowlist. If this is your own copy, add your email to the{" "}
            <code className="rounded bg-neutral-100 px-1 dark:bg-neutral-800">
              app_access
            </code>{" "}
            table.
          </p>
          <form action={signOut} className="mt-4">
            <button className={buttonStyles.reject} type="submit">
              Sign out
            </button>
          </form>
        </Card>
      </Shell>
    );
  }

  const data = await getDashboard();

  if (!data) {
    return (
      <Shell>
        <SetupForm />
      </Shell>
    );
  }

  const { student, pending, balance, recent, paymentHistory, activeSchedules } =
    data;
  const today = localNow(new Date(), student.timezone).date;

  const scheduleSummary = activeSchedules.length
    ? `${activeSchedules
        .map((s) => formatWeekday(s.weekday).slice(0, 3))
        .join(" · ")} at ${formatTime(activeSchedules[0].start_time)}`
    : "No schedule set";

  return (
    <Shell>
      <header className="flex items-start justify-between gap-3 px-1">
        <div>
          <h1 className="text-2xl font-semibold">{student.name}</h1>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {scheduleSummary}
          </p>
        </div>
        <form action={signOut}>
          <button className={buttonStyles.quiet} type="submit">
            Sign out
          </button>
        </form>
      </header>

      <PendingQueue pending={pending} />
      <BalanceCard balance={balance} payments={paymentHistory} />
      <AddClass today={today} />
      <PushToggle pendingCount={pending.length} />
      <SessionLog sessions={recent} />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4 pb-16">
      {children}
    </main>
  );
}
