// Regenerate after a migration:
//   npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts

export type SessionStatus = "confirmed" | "cancelled";

export type StudentRow = {
  id: number;
  owner_id: string;
  name: string;
  rate_paise: number;
  timezone: string;
  archived_at: string | null;
  created_at: string;
};

export type ScheduleRow = {
  id: number;
  student_id: number;
  weekday: number;
  start_time: string;
  active_from: string;
  active_until: string | null;
  created_at: string;
};

export type SessionRow = {
  id: number;
  student_id: number;
  schedule_id: number | null;
  date: string;
  status: SessionStatus;
  rate_paise: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type PaymentRow = {
  id: number;
  student_id: number;
  date: string;
  amount_paise: number;
  note: string | null;
  created_at: string;
};

export type PushSubscriptionRow = {
  id: number;
  owner_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  created_at: string;
};

export type StudentBalanceRow = {
  student_id: number;
  earned_paise: number;
  paid_paise: number;
  owed_paise: number;
  confirmed_classes: number;
};

// Flattened on purpose. supabase-js checks this against GenericSchema, whose
// members are Record<string, unknown>, and an intersection gets no implicit
// index signature. Leave it as Omit & Partial and every query becomes never.
type Flatten<T> = { [K in keyof T]: T[K] };

type Insertable<T, Optional extends keyof T> = Flatten<
  Omit<T, Optional> & Partial<Pick<T, Optional>>
>;

export type Database = {
  public: {
    Tables: {
      students: {
        Row: StudentRow;
        Insert: Insertable<
          StudentRow,
          "id" | "timezone" | "archived_at" | "created_at"
        >;
        Update: Partial<StudentRow>;
        Relationships: [];
      };
      schedules: {
        Row: ScheduleRow;
        Insert: Insertable<ScheduleRow, "id" | "active_until" | "created_at">;
        Update: Partial<ScheduleRow>;
        Relationships: [];
      };
      sessions: {
        Row: SessionRow;
        Insert: Insertable<
          SessionRow,
          | "id"
          | "schedule_id"
          | "rate_paise"
          | "notes"
          | "created_at"
          | "updated_at"
        >;
        Update: Partial<SessionRow>;
        Relationships: [];
      };
      payments: {
        Row: PaymentRow;
        Insert: Insertable<PaymentRow, "id" | "note" | "created_at">;
        Update: Partial<PaymentRow>;
        Relationships: [];
      };
      push_subscriptions: {
        Row: PushSubscriptionRow;
        Insert: Insertable<PushSubscriptionRow, "id" | "created_at">;
        Update: Partial<PushSubscriptionRow>;
        Relationships: [];
      };
    };
    Views: {
      student_balances: {
        Row: StudentBalanceRow;
        Relationships: [];
      };
    };
    Functions: {
      is_allowed: { Args: Record<string, never>; Returns: boolean };
      owns_student: { Args: { p_student_id: number }; Returns: boolean };
      create_setup: {
        Args: {
          p_name: string;
          p_rate_paise: number;
          p_timezone: string;
          p_weekdays: number[];
          p_start_time: string;
          p_from: string;
        };
        Returns: number;
      };
      change_schedule: {
        Args: {
          p_student_id: number;
          p_weekdays: number[];
          p_start_time: string;
          p_from: string;
        };
        Returns: undefined;
      };
      resolve_class: {
        Args: {
          p_student_id: number;
          p_schedule_id: number | null;
          p_date: string;
          p_status: SessionStatus;
        };
        Returns: undefined;
      };
      resolve_many: {
        Args: {
          p_student_id: number;
          p_rows: { date: string; scheduleId: number | null }[];
          p_status: SessionStatus;
        };
        Returns: number;
      };
      toggle_session: { Args: { p_session_id: number }; Returns: undefined };
    };
    Enums: { session_status: SessionStatus };
    CompositeTypes: Record<string, never>;
  };
};
