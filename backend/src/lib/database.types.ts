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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      chat_history: {
        Row: {
          created_at: string | null
          enkrypt_status: string | null
          id: string
          message: string | null
          response: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          enkrypt_status?: string | null
          id?: string
          message?: string | null
          response?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          enkrypt_status?: string | null
          id?: string
          message?: string | null
          response?: string | null
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          created_at: string | null
          doc_type: string | null
          error_message: string | null
          file_path: string
          id: string
          status: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          doc_type?: string | null
          error_message?: string | null
          file_path: string
          id?: string
          status?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          doc_type?: string | null
          error_message?: string | null
          file_path?: string
          id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: []
      }
      financial_profiles: {
        Row: {
          cash_flow: number | null
          categories: Json | null
          currency: string | null
          health_score: number | null
          id: string
          monthly_expenses: number | null
          monthly_income: number | null
          net_worth: number | null
          priority_review: boolean | null
          savings: number | null
          total_debt: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          cash_flow?: number | null
          categories?: Json | null
          currency?: string | null
          health_score?: number | null
          id?: string
          monthly_expenses?: number | null
          monthly_income?: number | null
          net_worth?: number | null
          priority_review?: boolean | null
          savings?: number | null
          total_debt?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          cash_flow?: number | null
          categories?: Json | null
          currency?: string | null
          health_score?: number | null
          id?: string
          monthly_expenses?: number | null
          monthly_income?: number | null
          net_worth?: number | null
          priority_review?: boolean | null
          savings?: number | null
          total_debt?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      manual_financial_info: {
        Row: {
          cash_savings: number | null
          created_at: string | null
          emergency_fund: number | null
          financial_goals: string | null
          gold: number | null
          id: string
          investments: number | null
          mutual_funds: number | null
          real_estate: number | null
          stocks: number | null
          user_id: string
        }
        Insert: {
          cash_savings?: number | null
          created_at?: string | null
          emergency_fund?: number | null
          financial_goals?: string | null
          gold?: number | null
          id?: string
          investments?: number | null
          mutual_funds?: number | null
          real_estate?: number | null
          stocks?: number | null
          user_id: string
        }
        Update: {
          cash_savings?: number | null
          created_at?: string | null
          emergency_fund?: number | null
          financial_goals?: string | null
          gold?: number | null
          id?: string
          investments?: number | null
          mutual_funds?: number | null
          real_estate?: number | null
          stocks?: number | null
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string | null
          full_name: string | null
          id: string
        }
        Insert: {
          created_at?: string | null
          full_name?: string | null
          id: string
        }
        Update: {
          created_at?: string | null
          full_name?: string | null
          id?: string
        }
        Relationships: []
      }
      recommendations: {
        Row: {
          based_on_profile_id: string | null
          content: string | null
          created_at: string | null
          enkrypt_status: string | null
          id: string
          status: string | null
          user_id: string
        }
        Insert: {
          based_on_profile_id?: string | null
          content?: string | null
          created_at?: string | null
          enkrypt_status?: string | null
          id?: string
          status?: string | null
          user_id: string
        }
        Update: {
          based_on_profile_id?: string | null
          content?: string | null
          created_at?: string | null
          enkrypt_status?: string | null
          id?: string
          status?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recommendations_based_on_profile_id_fkey"
            columns: ["based_on_profile_id"]
            isOneToOne: false
            referencedRelation: "financial_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      risk_scores: {
        Row: {
          cash_flow_status: string | null
          created_at: string | null
          credit_utilization: number | null
          debt_to_income: number | null
          id: string
          risk_factors: Json | null
          risk_score: number | null
          savings_adequacy: string | null
          user_id: string
        }
        Insert: {
          cash_flow_status?: string | null
          created_at?: string | null
          credit_utilization?: number | null
          debt_to_income?: number | null
          id?: string
          risk_factors?: Json | null
          risk_score?: number | null
          savings_adequacy?: string | null
          user_id: string
        }
        Update: {
          cash_flow_status?: string | null
          created_at?: string | null
          credit_utilization?: number | null
          debt_to_income?: number | null
          id?: string
          risk_factors?: Json | null
          risk_score?: number | null
          savings_adequacy?: string | null
          user_id?: string
        }
        Relationships: []
      }
      simulations: {
        Row: {
          created_at: string | null
          id: string
          input_params: Json | null
          projected_outcome: Json | null
          scenario_type: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          input_params?: Json | null
          projected_outcome?: Json | null
          scenario_type?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          input_params?: Json | null
          projected_outcome?: Json | null
          scenario_type?: string | null
          user_id?: string
        }
        Relationships: []
      }
      validation_logs: {
        Row: {
          adherence_score: number | null
          agent: string
          created_at: string | null
          duration_ms: number | null
          event_type: string
          id: string
          issues: Json | null
          passed_factual: boolean
          passed_safety: boolean
          response_id: string
          response_preview: string | null
          safety_score: number | null
          user_id: string
          validation_mode: string
          warnings: Json | null
        }
        Insert: {
          adherence_score?: number | null
          agent: string
          created_at?: string | null
          duration_ms?: number | null
          event_type: string
          id?: string
          issues?: Json | null
          passed_factual: boolean
          passed_safety: boolean
          response_id: string
          response_preview?: string | null
          safety_score?: number | null
          user_id: string
          validation_mode: string
          warnings?: Json | null
        }
        Update: {
          adherence_score?: number | null
          agent?: string
          created_at?: string | null
          duration_ms?: number | null
          event_type?: string
          id?: string
          issues?: Json | null
          passed_factual?: boolean
          passed_safety?: boolean
          response_id?: string
          response_preview?: string | null
          safety_score?: number | null
          user_id?: string
          validation_mode?: string
          warnings?: Json | null
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number | null
          category: string | null
          created_at: string | null
          date: string | null
          document_id: string | null
          id: string
          merchant: string | null
          type: string | null
          user_id: string
        }
        Insert: {
          amount?: number | null
          category?: string | null
          created_at?: string | null
          date?: string | null
          document_id?: string | null
          id?: string
          merchant?: string | null
          type?: string | null
          user_id: string
        }
        Update: {
          amount?: number | null
          category?: string | null
          created_at?: string | null
          date?: string | null
          document_id?: string | null
          id?: string
          merchant?: string | null
          type?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
