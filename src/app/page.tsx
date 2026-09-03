import { signOut } from "./auth/actions";
import { AddClass } from "./_components/add-class";
import { BalanceCard } from "./_components/balance-card";
import { PendingQueue } from "./_components/pending-queue";
import { ScheduleCard } from "./_components/schedule-card";
import { PushToggle } from "./_components/push-toggle";
import { SessionLog } from "./_components/session-log";
import { SetupForm } from "./_components/setup-form";
import { buttonStyles, Card } from "./_components/ui";

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

  return (
    // One column on mobile. On desktop the page itself stops scrolling and
    // each column gets its own scroller.
    <main className="mx-auto w-full max-w-6xl p-4 pb-16 min-[900px]:flex min-[900px]:h-dvh min-[900px]:gap-6 min-[900px]:overflow-hidden min-[900px]:pb-6">
      <div className="flex flex-col gap-4 min-[900px]:min-h-0 min-[900px]:w-1/2 min-[900px]:overflow-y-auto min-[900px]:pr-1">
        <header className="flex items-start justify-between gap-3 px-1">
          <h1 className="text-2xl font-semibold">{student.name}</h1>
          <form action={signOut}>
            <button className={buttonStyles.quiet} type="submit">
              Sign out
            </button>
          </form>
        </header>

        <PendingQueue pending={pending} />
        <BalanceCard balance={balance} payments={paymentHistory} />
        <AddClass today={today} />
        <ScheduleCard schedules={activeSchedules} today={today} />
        <PushToggle pendingCount={pending.length} />
      </div>

      <div className="mt-4 min-[900px]:mt-0 min-[900px]:flex min-[900px]:min-h-0 min-[900px]:w-1/2">
        <SessionLog sessions={recent} />
      </div>
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-col gap-4 p-4 pb-16">
      {children}
    </main>
  );
}
