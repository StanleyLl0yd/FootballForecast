// Generated from the actual FootballForecast Frankfurt Supabase Free database.
// Schema checked 2026-10-18. Do not edit manually: regenerate after approved SQL migrations.
// Contains schema metadata only, never row contents or access credentials.
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
      ff_access_grants: {
        Row: {
          created_at: string
          provider_id: string
          role: string
          user_id: string
        }
        Insert: {
          created_at?: string
          provider_id: string
          role: string
          user_id: string
        }
        Update: {
          created_at?: string
          provider_id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      ff_competitions: {
        Row: {
          code: string
          id: string
          name: string
          timezone: string
        }
        Insert: {
          code: string
          id?: string
          name: string
          timezone?: string
        }
        Update: {
          code?: string
          id?: string
          name?: string
          timezone?: string
        }
        Relationships: []
      }
      ff_forecast_outcomes: {
        Row: {
          brier: number
          evaluated_at: string
          forecast_id: string
          id: string
          log_loss: number
          result_away: number
          result_home: number
          rps: number
        }
        Insert: {
          brier: number
          evaluated_at?: string
          forecast_id: string
          id?: string
          log_loss: number
          result_away: number
          result_home: number
          rps: number
        }
        Update: {
          brier?: number
          evaluated_at?: string
          forecast_id?: string
          id?: string
          log_loss?: number
          result_away?: number
          result_home?: number
          rps?: number
        }
        Relationships: [
          {
            foreignKeyName: "ff_forecast_outcomes_forecast_id_fkey"
            columns: ["forecast_id"]
            isOneToOne: true
            referencedRelation: "ff_forecasts"
            referencedColumns: ["id"]
          },
        ]
      }
      ff_forecasts: {
        Row: {
          as_of_at: string
          away_win: number
          commit_sha: string
          dataset_sha256: string
          draw: number
          expected_away: number
          expected_home: number
          home_win: number
          id: string
          match_id: string
          model_sha256: string
          model_version: string
          predicted_at: string
          prediction_sha256: string
          revision: number
          score_distribution: Json
        }
        Insert: {
          as_of_at: string
          away_win: number
          commit_sha: string
          dataset_sha256: string
          draw: number
          expected_away: number
          expected_home: number
          home_win: number
          id?: string
          match_id: string
          model_sha256: string
          model_version: string
          predicted_at: string
          prediction_sha256: string
          revision: number
          score_distribution: Json
        }
        Update: {
          as_of_at?: string
          away_win?: number
          commit_sha?: string
          dataset_sha256?: string
          draw?: number
          expected_away?: number
          expected_home?: number
          home_win?: number
          id?: string
          match_id?: string
          model_sha256?: string
          model_version?: string
          predicted_at?: string
          prediction_sha256?: string
          revision?: number
          score_distribution?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ff_forecasts_match_id_fkey"
            columns: ["match_id"]
            isOneToOne: false
            referencedRelation: "ff_matches"
            referencedColumns: ["id"]
          },
        ]
      }
      ff_matches: {
        Row: {
          away_goals: number | null
          away_id: string
          home_goals: number | null
          home_id: string
          id: string
          kickoff_at: string
          season_id: string
          status: string
          updated_at: string
        }
        Insert: {
          away_goals?: number | null
          away_id: string
          home_goals?: number | null
          home_id: string
          id?: string
          kickoff_at: string
          season_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          away_goals?: number | null
          away_id?: string
          home_goals?: number | null
          home_id?: string
          id?: string
          kickoff_at?: string
          season_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ff_matches_away_id_fkey"
            columns: ["away_id"]
            isOneToOne: false
            referencedRelation: "ff_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ff_matches_home_id_fkey"
            columns: ["home_id"]
            isOneToOne: false
            referencedRelation: "ff_teams"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ff_matches_season_id_fkey"
            columns: ["season_id"]
            isOneToOne: false
            referencedRelation: "ff_seasons"
            referencedColumns: ["id"]
          },
        ]
      }
      ff_seasons: {
        Row: {
          competition_id: string
          id: string
          name: string
        }
        Insert: {
          competition_id: string
          id?: string
          name: string
        }
        Update: {
          competition_id?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "ff_seasons_competition_id_fkey"
            columns: ["competition_id"]
            isOneToOne: false
            referencedRelation: "ff_competitions"
            referencedColumns: ["id"]
          },
        ]
      }
      ff_source_records: {
        Row: {
          content_hash: string
          event_at: string
          id: string
          ingested_at: string
          provider_id: string
          published_at: string | null
          source_id: string
          source_version: string
        }
        Insert: {
          content_hash: string
          event_at: string
          id?: string
          ingested_at?: string
          provider_id: string
          published_at?: string | null
          source_id: string
          source_version: string
        }
        Update: {
          content_hash?: string
          event_at?: string
          id?: string
          ingested_at?: string
          provider_id?: string
          published_at?: string | null
          source_id?: string
          source_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "ff_source_records_source_id_fkey"
            columns: ["source_id"]
            isOneToOne: false
            referencedRelation: "ff_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      ff_sources: {
        Row: {
          approved_at: string | null
          created_at: string
          id: string
          license_reference: string | null
          license_status: string
          name: string
        }
        Insert: {
          approved_at?: string | null
          created_at?: string
          id?: string
          license_reference?: string | null
          license_status?: string
          name: string
        }
        Update: {
          approved_at?: string | null
          created_at?: string
          id?: string
          license_reference?: string | null
          license_status?: string
          name?: string
        }
        Relationships: []
      }
      ff_teams: {
        Row: {
          id: string
          name: string
          normalized_name: string
        }
        Insert: {
          id?: string
          name: string
          normalized_name: string
        }
        Update: {
          id?: string
          name?: string
          normalized_name?: string
        }
        Relationships: []
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
