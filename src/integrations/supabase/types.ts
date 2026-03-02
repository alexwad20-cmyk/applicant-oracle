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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      candidate_events: {
        Row: {
          action_type: string
          actor_user_id: string | null
          candidate_id: string
          created_at: string
          from_stage: Database["public"]["Enums"]["candidate_stage"] | null
          id: string
          notes: string | null
          reason_code: Database["public"]["Enums"]["rejection_reason"] | null
          to_stage: Database["public"]["Enums"]["candidate_stage"] | null
        }
        Insert: {
          action_type: string
          actor_user_id?: string | null
          candidate_id: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["candidate_stage"] | null
          id?: string
          notes?: string | null
          reason_code?: Database["public"]["Enums"]["rejection_reason"] | null
          to_stage?: Database["public"]["Enums"]["candidate_stage"] | null
        }
        Update: {
          action_type?: string
          actor_user_id?: string | null
          candidate_id?: string
          created_at?: string
          from_stage?: Database["public"]["Enums"]["candidate_stage"] | null
          id?: string
          notes?: string | null
          reason_code?: Database["public"]["Enums"]["rejection_reason"] | null
          to_stage?: Database["public"]["Enums"]["candidate_stage"] | null
        }
        Relationships: [
          {
            foreignKeyName: "candidate_events_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          agency_name: string | null
          created_at: string
          created_by: string | null
          cv_file_path: string | null
          duplicate_of_candidate_id: string | null
          email: string
          full_name: string
          hm_review_due_at: string | null
          id: string
          job_id: string
          last_reminder_sent_at: string | null
          notes: string | null
          phone: string
          reminder_count: number
          source: Database["public"]["Enums"]["candidate_source"]
          stage: Database["public"]["Enums"]["candidate_stage"]
          stage_updated_at: string
          updated_at: string
          visa_required: boolean
        }
        Insert: {
          agency_name?: string | null
          created_at?: string
          created_by?: string | null
          cv_file_path?: string | null
          duplicate_of_candidate_id?: string | null
          email?: string
          full_name: string
          hm_review_due_at?: string | null
          id?: string
          job_id: string
          last_reminder_sent_at?: string | null
          notes?: string | null
          phone?: string
          reminder_count?: number
          source?: Database["public"]["Enums"]["candidate_source"]
          stage?: Database["public"]["Enums"]["candidate_stage"]
          stage_updated_at?: string
          updated_at?: string
          visa_required?: boolean
        }
        Update: {
          agency_name?: string | null
          created_at?: string
          created_by?: string | null
          cv_file_path?: string | null
          duplicate_of_candidate_id?: string | null
          email?: string
          full_name?: string
          hm_review_due_at?: string | null
          id?: string
          job_id?: string
          last_reminder_sent_at?: string | null
          notes?: string | null
          phone?: string
          reminder_count?: number
          source?: Database["public"]["Enums"]["candidate_source"]
          stage?: Database["public"]["Enums"]["candidate_stage"]
          stage_updated_at?: string
          updated_at?: string
          visa_required?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "candidates_duplicate_of_candidate_id_fkey"
            columns: ["duplicate_of_candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidates_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          created_at: string
          department: string
          description: string
          hiring_manager_user_id: string | null
          id: string
          location: string
          recruiter_user_id: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string
          description?: string
          hiring_manager_user_id?: string | null
          id?: string
          location?: string
          recruiter_user_id?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string
          description?: string
          hiring_manager_user_id?: string | null
          id?: string
          location?: string
          recruiter_user_id?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      review_tokens: {
        Row: {
          candidate_id: string
          created_at: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
        }
        Insert: {
          candidate_id: string
          created_at?: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
        }
        Update: {
          candidate_id?: string
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "review_tokens_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_hr_or_admin: { Args: { _user_id: string }; Returns: boolean }
    }
    Enums: {
      app_role: "admin" | "hr" | "hiring_manager"
      candidate_source: "direct" | "agency" | "referral"
      candidate_stage:
        | "new_applicant"
        | "hm_review"
        | "hm_approved"
        | "hm_rejected"
      rejection_reason:
        | "skills_mismatch"
        | "experience_level"
        | "salary_mismatch"
        | "location_commute"
        | "notice_period"
        | "right_to_work"
        | "culture_values"
        | "declined_role"
        | "counteroffer"
        | "other"
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
    Enums: {
      app_role: ["admin", "hr", "hiring_manager"],
      candidate_source: ["direct", "agency", "referral"],
      candidate_stage: [
        "new_applicant",
        "hm_review",
        "hm_approved",
        "hm_rejected",
      ],
      rejection_reason: [
        "skills_mismatch",
        "experience_level",
        "salary_mismatch",
        "location_commute",
        "notice_period",
        "right_to_work",
        "culture_values",
        "declined_role",
        "counteroffer",
        "other",
      ],
    },
  },
} as const
