export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      app_owner: {
        Row: {
          created_at: string
          singleton: boolean
          user_id: string
        }
        Insert: {
          created_at?: string
          singleton?: boolean
          user_id: string
        }
        Update: {
          created_at?: string
          singleton?: boolean
          user_id?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          archived_at: string | null
          created_at: string
          id: string
          kind: string
          name: string
          owner_id: string
          parent_id: string | null
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          id?: string
          kind: string
          name: string
          owner_id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          id?: string
          kind?: string
          name?: string
          owner_id?: string
          parent_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      categorization_rules: {
        Row: {
          category_id: string
          created_at: string
          id: string
          owner_id: string
          term: string
        }
        Insert: {
          category_id: string
          created_at?: string
          id?: string
          owner_id?: string
          term: string
        }
        Update: {
          category_id?: string
          created_at?: string
          id?: string
          owner_id?: string
          term?: string
        }
        Relationships: [
          {
            foreignKeyName: "categorization_rules_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      csv_mappings: {
        Row: {
          account_id: string
          mapping: Json
          owner_id: string
          updated_at: string
        }
        Insert: {
          account_id: string
          mapping: Json
          owner_id?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          mapping?: Json
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "csv_mappings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "csv_mappings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: true
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      financial_accounts: {
        Row: {
          archived_at: string | null
          created_at: string
          currency: string
          id: string
          institution: string | null
          name: string
          opening_balance: number
          opening_date: string
          owner_id: string
          type: string
          updated_at: string
        }
        Insert: {
          archived_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          institution?: string | null
          name: string
          opening_balance?: number
          opening_date: string
          owner_id?: string
          type: string
          updated_at?: string
        }
        Update: {
          archived_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          institution?: string | null
          name?: string
          opening_balance?: number
          opening_date?: string
          owner_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      import_batches: {
        Row: {
          account_id: string | null
          created_at: string
          file_name: string | null
          id: string
          imported_count: number
          owner_id: string
          skipped_count: number
          source: string
          status: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          imported_count?: number
          owner_id?: string
          skipped_count?: number
          source?: string
          status?: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          file_name?: string | null
          id?: string
          imported_count?: number
          owner_id?: string
          skipped_count?: number
          source?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "import_batches_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_adjustments: {
        Row: {
          created_at: string
          effective_from: string
          id: string
          new_amount: number
          owner_id: string
          previous_amount: number
          recurring_id: string
        }
        Insert: {
          created_at?: string
          effective_from: string
          id?: string
          new_amount: number
          owner_id?: string
          previous_amount: number
          recurring_id: string
        }
        Update: {
          created_at?: string
          effective_from?: string
          id?: string
          new_amount?: number
          owner_id?: string
          previous_amount?: number
          recurring_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_adjustments_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_items"
            referencedColumns: ["id"]
          },
        ]
      }
      recurring_items: {
        Row: {
          account_id: string
          active: boolean
          amount: number
          category_id: string
          created_at: string
          custom_dates: string[]
          description: string
          due_day: number
          end_date: string | null
          frequency: string
          id: string
          installment_count: number | null
          kind: string
          owner_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          account_id: string
          active?: boolean
          amount: number
          category_id: string
          created_at?: string
          custom_dates?: string[]
          description: string
          due_day?: number
          end_date?: string | null
          frequency?: string
          id?: string
          installment_count?: number | null
          kind: string
          owner_id?: string
          start_date: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          active?: boolean
          amount?: number
          category_id?: string
          created_at?: string
          custom_dates?: string[]
          description?: string
          due_day?: number
          end_date?: string | null
          frequency?: string
          id?: string
          installment_count?: number | null
          kind?: string
          owner_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recurring_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "recurring_items_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recurring_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
        ]
      }
      transactions: {
        Row: {
          account_id: string
          amount: number
          cancel_reason: string | null
          cancelled_at: string | null
          category_id: string | null
          competence: string | null
          created_at: string
          date: string
          description: string
          destination_account_id: string | null
          external_ref: string | null
          id: string
          import_batch_id: string | null
          kind: string
          notes: string | null
          occurrence_date: string | null
          owner_id: string
          recurring_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          account_id: string
          amount: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          category_id?: string | null
          competence?: string | null
          created_at?: string
          date: string
          description: string
          destination_account_id?: string | null
          external_ref?: string | null
          id?: string
          import_batch_id?: string | null
          kind: string
          notes?: string | null
          occurrence_date?: string | null
          owner_id?: string
          recurring_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          account_id?: string
          amount?: number
          cancel_reason?: string | null
          cancelled_at?: string | null
          category_id?: string | null
          competence?: string | null
          created_at?: string
          date?: string
          description?: string
          destination_account_id?: string | null
          external_ref?: string | null
          id?: string
          import_batch_id?: string | null
          kind?: string
          notes?: string | null
          occurrence_date?: string | null
          owner_id?: string
          recurring_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "account_balances"
            referencedColumns: ["account_id"]
          },
          {
            foreignKeyName: "transactions_destination_account_id_fkey"
            columns: ["destination_account_id"]
            isOneToOne: false
            referencedRelation: "financial_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_recurring_id_fkey"
            columns: ["recurring_id"]
            isOneToOne: false
            referencedRelation: "recurring_items"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      account_balances: {
        Row: {
          account_id: string | null
          archived_at: string | null
          balance: number | null
          currency: string | null
          expense_posted: number | null
          income_posted: number | null
          name: string | null
          opening_balance: number | null
          opening_date: string | null
          owner_id: string | null
          pending_net: number | null
          transfer_in: number | null
          transfer_out: number | null
          type: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      claim_ownership: { Args: never; Returns: boolean }
      commit_csv_import: {
        Args: {
          p_account: string
          p_file: string
          p_mapping: Json
          p_rows: Json
        }
        Returns: Json
      }
      is_owner: { Args: never; Returns: boolean }
      load_default_categories: { Args: { p_groups: Json }; Returns: number }
      phase2_due_dates: {
        Args: {
          date_from: string
          date_to: string
          r: Database["public"]["Tables"]["recurring_items"]["Row"]
        }
        Returns: string[]
      }
      phase2_expected_amount: {
        Args: { p_due: string; p_id: string }
        Returns: number
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
