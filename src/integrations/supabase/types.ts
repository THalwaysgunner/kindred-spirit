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
      applications: {
        Row: {
          about_the_role: string | null
          company: string
          created_at: string
          description: string | null
          employment_status: string | null
          experience_level: string | null
          hq_address: string | null
          id: string
          industries: string[] | null
          job_details: Json
          job_resume: string | null
          job_title: string
          job_url: string | null
          location: string | null
          logo_url: string | null
          match_score: number | null
          nice_to_have: string | null
          notes: string | null
          posted_on: string | null
          profile_id: string
          requirements: string | null
          responsibilities: string | null
          status: string | null
          tailored_resume: Json
        }
        Insert: {
          about_the_role?: string | null
          company: string
          created_at?: string
          description?: string | null
          employment_status?: string | null
          experience_level?: string | null
          hq_address?: string | null
          id?: string
          industries?: string[] | null
          job_details?: Json
          job_resume?: string | null
          job_title: string
          job_url?: string | null
          location?: string | null
          logo_url?: string | null
          match_score?: number | null
          nice_to_have?: string | null
          notes?: string | null
          posted_on?: string | null
          profile_id: string
          requirements?: string | null
          responsibilities?: string | null
          status?: string | null
          tailored_resume?: Json
        }
        Update: {
          about_the_role?: string | null
          company?: string
          created_at?: string
          description?: string | null
          employment_status?: string | null
          experience_level?: string | null
          hq_address?: string | null
          id?: string
          industries?: string[] | null
          job_details?: Json
          job_resume?: string | null
          job_title?: string
          job_url?: string | null
          location?: string | null
          logo_url?: string | null
          match_score?: number | null
          nice_to_have?: string | null
          notes?: string | null
          posted_on?: string | null
          profile_id?: string
          requirements?: string | null
          responsibilities?: string | null
          status?: string | null
          tailored_resume?: Json
        }
        Relationships: [
          {
            foreignKeyName: "applications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      education: {
        Row: {
          created_at: string
          degree: string | null
          field_of_study: string | null
          id: string
          institution: string
          logo_url: string | null
          profile_id: string
          year: string | null
        }
        Insert: {
          created_at?: string
          degree?: string | null
          field_of_study?: string | null
          id?: string
          institution: string
          logo_url?: string | null
          profile_id: string
          year?: string | null
        }
        Update: {
          created_at?: string
          degree?: string | null
          field_of_study?: string | null
          id?: string
          institution?: string
          logo_url?: string | null
          profile_id?: string
          year?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "education_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      experience: {
        Row: {
          company: string
          created_at: string
          dates: string | null
          description: string | null
          duration: string | null
          id: string
          location: string | null
          logo_url: string | null
          profile_id: string
          role: string
        }
        Insert: {
          company: string
          created_at?: string
          dates?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          location?: string | null
          logo_url?: string | null
          profile_id: string
          role: string
        }
        Update: {
          company?: string
          created_at?: string
          dates?: string | null
          description?: string | null
          duration?: string | null
          id?: string
          location?: string | null
          logo_url?: string | null
          profile_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "experience_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      job_search_cache: {
        Row: {
          created_at: string
          expires_at: string
          filters: Json | null
          id: string
          jobs: Json
          keywords: string | null
          location: string | null
          search_hash: string
          total_count: number | null
        }
        Insert: {
          created_at?: string
          expires_at?: string
          filters?: Json | null
          id?: string
          jobs?: Json
          keywords?: string | null
          location?: string | null
          search_hash: string
          total_count?: number | null
        }
        Update: {
          created_at?: string
          expires_at?: string
          filters?: Json | null
          id?: string
          jobs?: Json
          keywords?: string | null
          location?: string | null
          search_hash?: string
          total_count?: number | null
        }
        Relationships: []
      }
      job_search_links: {
        Row: {
          created_at: string | null
          id: string
          job_id: string
          relevance_score: number | null
          search_term_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_id: string
          relevance_score?: number | null
          search_term_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          job_id?: string
          relevance_score?: number | null
          search_term_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_search_links_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_search_links_search_term_id_fkey"
            columns: ["search_term_id"]
            isOneToOne: false
            referencedRelation: "search_terms"
            referencedColumns: ["id"]
          },
        ]
      }
      jobs: {
        Row: {
          applicant_count: number | null
          benefits: Json | null
          company: string
          company_url: string | null
          created_at: string | null
          description: string | null
          expires_at: string | null
          id: string
          is_easy_apply: boolean | null
          job_id: string | null
          job_title: string
          job_url: string
          location: string | null
          posted_at: string | null
          posted_at_text: string | null
          raw_data: Json | null
          requirements: string | null
          salary: string | null
          skills: Json | null
          updated_at: string | null
          work_type: string | null
        }
        Insert: {
          applicant_count?: number | null
          benefits?: Json | null
          company: string
          company_url?: string | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_easy_apply?: boolean | null
          job_id?: string | null
          job_title: string
          job_url: string
          location?: string | null
          posted_at?: string | null
          posted_at_text?: string | null
          raw_data?: Json | null
          requirements?: string | null
          salary?: string | null
          skills?: Json | null
          updated_at?: string | null
          work_type?: string | null
        }
        Update: {
          applicant_count?: number | null
          benefits?: Json | null
          company?: string
          company_url?: string | null
          created_at?: string | null
          description?: string | null
          expires_at?: string | null
          id?: string
          is_easy_apply?: boolean | null
          job_id?: string | null
          job_title?: string
          job_url?: string
          location?: string | null
          posted_at?: string | null
          posted_at_text?: string | null
          raw_data?: Json | null
          requirements?: string | null
          salary?: string | null
          skills?: Json | null
          updated_at?: string | null
          work_type?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          email: string | null
          full_name: string | null
          headline_role: string | null
          id: string
          linkedin_url: string | null
          phone: string | null
          profile_picture_url: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          email?: string | null
          full_name?: string | null
          headline_role?: string | null
          id: string
          linkedin_url?: string | null
          phone?: string | null
          profile_picture_url?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          email?: string | null
          full_name?: string | null
          headline_role?: string | null
          id?: string
          linkedin_url?: string | null
          phone?: string | null
          profile_picture_url?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      search_terms: {
        Row: {
          canonical_term: string
          created_at: string | null
          filters: Json | null
          id: string
          last_fetched_at: string | null
          last_searched_at: string | null
          location: string | null
          raw_term: string
          search_count: number | null
        }
        Insert: {
          canonical_term: string
          created_at?: string | null
          filters?: Json | null
          id?: string
          last_fetched_at?: string | null
          last_searched_at?: string | null
          location?: string | null
          raw_term: string
          search_count?: number | null
        }
        Update: {
          canonical_term?: string
          created_at?: string | null
          filters?: Json | null
          id?: string
          last_fetched_at?: string | null
          last_searched_at?: string | null
          location?: string | null
          raw_term?: string
          search_count?: number | null
        }
        Relationships: []
      }
      skills: {
        Row: {
          created_at: string
          id: string
          name: string
          profile_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          profile_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "skills_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
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
