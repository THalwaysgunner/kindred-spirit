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
      abilities: {
        Row: {
          data_value: string | null
          date: string | null
          domain_source: string | null
          element_id: string | null
          element_name: string | null
          lower_ci_bound: string | null
          n: string | null
          not_relevant: string | null
          o_net_soc_code: string | null
          recommend_suppress: string | null
          scale_id: string | null
          standard_error: string | null
          upper_ci_bound: string | null
        }
        Insert: {
          data_value?: string | null
          date?: string | null
          domain_source?: string | null
          element_id?: string | null
          element_name?: string | null
          lower_ci_bound?: string | null
          n?: string | null
          not_relevant?: string | null
          o_net_soc_code?: string | null
          recommend_suppress?: string | null
          scale_id?: string | null
          standard_error?: string | null
          upper_ci_bound?: string | null
        }
        Update: {
          data_value?: string | null
          date?: string | null
          domain_source?: string | null
          element_id?: string | null
          element_name?: string | null
          lower_ci_bound?: string | null
          n?: string | null
          not_relevant?: string | null
          o_net_soc_code?: string | null
          recommend_suppress?: string | null
          scale_id?: string | null
          standard_error?: string | null
          upper_ci_bound?: string | null
        }
        Relationships: []
      }
      abilities_to_work_activities: {
        Row: {
          abilities_element_id: string | null
          abilities_element_name: string | null
          work_activities_element_id: string | null
          work_activities_element_name: string | null
        }
        Insert: {
          abilities_element_id?: string | null
          abilities_element_name?: string | null
          work_activities_element_id?: string | null
          work_activities_element_name?: string | null
        }
        Update: {
          abilities_element_id?: string | null
          abilities_element_name?: string | null
          work_activities_element_id?: string | null
          work_activities_element_name?: string | null
        }
        Relationships: []
      }
      abilities_to_work_context: {
        Row: {
          abilities_element_id: string | null
          abilities_element_name: string | null
          work_context_element_id: string | null
          work_context_element_name: string | null
        }
        Insert: {
          abilities_element_id?: string | null
          abilities_element_name?: string | null
          work_context_element_id?: string | null
          work_context_element_name?: string | null
        }
        Update: {
          abilities_element_id?: string | null
          abilities_element_name?: string | null
          work_context_element_id?: string | null
          work_context_element_name?: string | null
        }
        Relationships: []
      }
      alternate_titles: {
        Row: {
          alternate_title: string | null
          o_net_soc_code: string | null
          short_title: string | null
          source_s: string | null
        }
        Insert: {
          alternate_title?: string | null
          o_net_soc_code?: string | null
          short_title?: string | null
          source_s?: string | null
        }
        Update: {
          alternate_title?: string | null
          o_net_soc_code?: string | null
          short_title?: string | null
          source_s?: string | null
        }
        Relationships: []
      }
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
      basic_interests_to_riasec: {
        Row: {
          basic_interests_element_id: string | null
          basic_interests_element_name: string | null
          riasec_element_id: string | null
          riasec_element_name: string | null
        }
        Insert: {
          basic_interests_element_id?: string | null
          basic_interests_element_name?: string | null
          riasec_element_id?: string | null
          riasec_element_name?: string | null
        }
        Update: {
          basic_interests_element_id?: string | null
          basic_interests_element_name?: string | null
          riasec_element_id?: string | null
          riasec_element_name?: string | null
        }
        Relationships: []
      }
      content_model_reference: {
        Row: {
          description: string | null
          element_id: string | null
          element_name: string | null
        }
        Insert: {
          description?: string | null
          element_id?: string | null
          element_name?: string | null
        }
        Update: {
          description?: string | null
          element_id?: string | null
          element_name?: string | null
        }
        Relationships: []
      }
      dwa_reference: {
        Row: {
          dwa_id: string | null
          dwa_title: string | null
          element_id: string | null
          iwa_id: string | null
        }
        Insert: {
          dwa_id?: string | null
          dwa_title?: string | null
          element_id?: string | null
          iwa_id?: string | null
        }
        Update: {
          dwa_id?: string | null
          dwa_title?: string | null
          element_id?: string | null
          iwa_id?: string | null
        }
        Relationships: []
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
      education_training_and_experience: {
        Row: {
          category: string | null
          data_value: string | null
          date: string | null
          domain_source: string | null
          element_id: string | null
          element_name: string | null
          lower_ci_bound: string | null
          n: string | null
          o_net_soc_code: string | null
          recommend_suppress: string | null
          scale_id: string | null
          standard_error: string | null
          upper_ci_bound: string | null
        }
        Insert: {
          category?: string | null
          data_value?: string | null
          date?: string | null
          domain_source?: string | null
          element_id?: string | null
          element_name?: string | null
          lower_ci_bound?: string | null
          n?: string | null
          o_net_soc_code?: string | null
          recommend_suppress?: string | null
          scale_id?: string | null
          standard_error?: string | null
          upper_ci_bound?: string | null
        }
        Update: {
          category?: string | null
          data_value?: string | null
          date?: string | null
          domain_source?: string | null
          element_id?: string | null
          element_name?: string | null
          lower_ci_bound?: string | null
          n?: string | null
          o_net_soc_code?: string | null
          recommend_suppress?: string | null
          scale_id?: string | null
          standard_error?: string | null
          upper_ci_bound?: string | null
        }
        Relationships: []
      }
      education_training_and_experience_categories: {
        Row: {
          category: string | null
          category_description: string | null
          element_id: string | null
          element_name: string | null
          scale_id: string | null
        }
        Insert: {
          category?: string | null
          category_description?: string | null
          element_id?: string | null
          element_name?: string | null
          scale_id?: string | null
        }
        Update: {
          category?: string | null
          category_description?: string | null
          element_id?: string | null
          element_name?: string | null
          scale_id?: string | null
        }
        Relationships: []
      }
      emerging_tasks: {
        Row: {
          category: string | null
          date: string | null
          domain_source: string | null
          o_net_soc_code: string | null
          original_task: string | null
          original_task_id: string | null
          task: string | null
        }
        Insert: {
          category?: string | null
          date?: string | null
          domain_source?: string | null
          o_net_soc_code?: string | null
          original_task?: string | null
          original_task_id?: string | null
          task?: string | null
        }
        Update: {
          category?: string | null
          date?: string | null
          domain_source?: string | null
          o_net_soc_code?: string | null
          original_task?: string | null
          original_task_id?: string | null
          task?: string | null
        }
        Relationships: []
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
      interests: {
        Row: {
          data_value: string | null
          date: string | null
          domain_source: string | null
          element_id: string | null
          element_name: string | null
          o_net_soc_code: string | null
          scale_id: string | null
        }
        Insert: {
          data_value?: string | null
          date?: string | null
          domain_source?: string | null
          element_id?: string | null
          element_name?: string | null
          o_net_soc_code?: string | null
          scale_id?: string | null
        }
        Update: {
          data_value?: string | null
          date?: string | null
          domain_source?: string | null
          element_id?: string | null
          element_name?: string | null
          o_net_soc_code?: string | null
          scale_id?: string | null
        }
        Relationships: []
      }
      interests_illustrative_activities: {
        Row: {
          activity: string | null
          element_id: string | null
          element_name: string | null
          interest_type: string | null
        }
        Insert: {
          activity?: string | null
          element_id?: string | null
          element_name?: string | null
          interest_type?: string | null
        }
        Update: {
          activity?: string | null
          element_id?: string | null
          element_name?: string | null
          interest_type?: string | null
        }
        Relationships: []
      }
      interests_illustrative_occupations: {
        Row: {
          element_id: string | null
          element_name: string | null
          interest_type: string | null
          o_net_soc_code: string | null
        }
        Insert: {
          element_id?: string | null
          element_name?: string | null
          interest_type?: string | null
          o_net_soc_code?: string | null
        }
        Update: {
          element_id?: string | null
          element_name?: string | null
          interest_type?: string | null
          o_net_soc_code?: string | null
        }
        Relationships: []
      }
      iwa_reference: {
        Row: {
          element_id: string | null
          iwa_id: string | null
          iwa_title: string | null
        }
        Insert: {
          element_id?: string | null
          iwa_id?: string | null
          iwa_title?: string | null
        }
        Update: {
          element_id?: string | null
          iwa_id?: string | null
          iwa_title?: string | null
        }
        Relationships: []
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
      job_zone_reference: {
        Row: {
          education: string | null
          examples: string | null
          experience: string | null
          job_training: string | null
          job_zone: string | null
          name: string | null
          svp_range: string | null
        }
        Insert: {
          education?: string | null
          examples?: string | null
          experience?: string | null
          job_training?: string | null
          job_zone?: string | null
          name?: string | null
          svp_range?: string | null
        }
        Update: {
          education?: string | null
          examples?: string | null
          experience?: string | null
          job_training?: string | null
          job_zone?: string | null
          name?: string | null
          svp_range?: string | null
        }
        Relationships: []
      }
      job_zones: {
        Row: {
          date: string | null
          domain_source: string | null
          job_zone: string | null
          o_net_soc_code: string | null
        }
        Insert: {
          date?: string | null
          domain_source?: string | null
          job_zone?: string | null
          o_net_soc_code?: string | null
        }
        Update: {
          date?: string | null
          domain_source?: string | null
          job_zone?: string | null
          o_net_soc_code?: string | null
        }
        Relationships: []
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
      knowledge: {
        Row: {
          data_value: string | null
          date: string | null
          domain_source: string | null
          element_id: string | null
          element_name: string | null
          lower_ci_bound: string | null
          n: string | null
          not_relevant: string | null
          o_net_soc_code: string | null
          recommend_suppress: string | null
          scale_id: string | null
          standard_error: string | null
          upper_ci_bound: string | null
        }
        Insert: {
          data_value?: string | null
          date?: string | null
          domain_source?: string | null
          element_id?: string | null
          element_name?: string | null
          lower_ci_bound?: string | null
          n?: string | null
          not_relevant?: string | null
          o_net_soc_code?: string | null
          recommend_suppress?: string | null
          scale_id?: string | null
          standard_error?: string | null
          upper_ci_bound?: string | null
        }
        Update: {
          data_value?: string | null
          date?: string | null
          domain_source?: string | null
          element_id?: string | null
          element_name?: string | null
          lower_ci_bound?: string | null
          n?: string | null
          not_relevant?: string | null
          o_net_soc_code?: string | null
          recommend_suppress?: string | null
          scale_id?: string | null
          standard_error?: string | null
          upper_ci_bound?: string | null
        }
        Relationships: []
      }
      level_scale_anchors: {
        Row: {
          anchor_description: string | null
          anchor_value: string | null
          element_id: string | null
          element_name: string | null
          scale_id: string | null
        }
        Insert: {
          anchor_description?: string | null
          anchor_value?: string | null
          element_id?: string | null
          element_name?: string | null
          scale_id?: string | null
        }
        Update: {
          anchor_description?: string | null
          anchor_value?: string | null
          element_id?: string | null
          element_name?: string | null
          scale_id?: string | null
        }
        Relationships: []
      }
      occupation_data: {
        Row: {
          description: string | null
          o_net_soc_code: string | null
          title: string | null
        }
        Insert: {
          description?: string | null
          o_net_soc_code?: string | null
          title?: string | null
        }
        Update: {
          description?: string | null
          o_net_soc_code?: string | null
          title?: string | null
        }
        Relationships: []
      }
      occupation_level_metadata: {
        Row: {
          date: string | null
          item: string | null
          n: string | null
          o_net_soc_code: string | null
          percent: string | null
          response: string | null
        }
        Insert: {
          date?: string | null
          item?: string | null
          n?: string | null
          o_net_soc_code?: string | null
          percent?: string | null
          response?: string | null
        }
        Update: {
          date?: string | null
          item?: string | null
          n?: string | null
          o_net_soc_code?: string | null
          percent?: string | null
          response?: string | null
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
      read_me: {
        Row: {
          o_net_30_1_database: string | null
        }
        Insert: {
          o_net_30_1_database?: string | null
        }
        Update: {
          o_net_30_1_database?: string | null
        }
        Relationships: []
      }
      related_occupations: {
        Row: {
          index: string | null
          o_net_soc_code: string | null
          related_o_net_soc_code: string | null
          relatedness_tier: string | null
        }
        Insert: {
          index?: string | null
          o_net_soc_code?: string | null
          related_o_net_soc_code?: string | null
          relatedness_tier?: string | null
        }
        Update: {
          index?: string | null
          o_net_soc_code?: string | null
          related_o_net_soc_code?: string | null
          relatedness_tier?: string | null
        }
        Relationships: []
      }
      riasec_keywords: {
        Row: {
          element_id: string | null
          element_name: string | null
          keyword: string | null
          keyword_type: string | null
        }
        Insert: {
          element_id?: string | null
          element_name?: string | null
          keyword?: string | null
          keyword_type?: string | null
        }
        Update: {
          element_id?: string | null
          element_name?: string | null
          keyword?: string | null
          keyword_type?: string | null
        }
        Relationships: []
      }
      sample_of_reported_titles: {
        Row: {
          o_net_soc_code: string | null
          reported_job_title: string | null
          shown_in_my_next_move: string | null
        }
        Insert: {
          o_net_soc_code?: string | null
          reported_job_title?: string | null
          shown_in_my_next_move?: string | null
        }
        Update: {
          o_net_soc_code?: string | null
          reported_job_title?: string | null
          shown_in_my_next_move?: string | null
        }
        Relationships: []
      }
      scales_reference: {
        Row: {
          maximum: string | null
          minimum: string | null
          scale_id: string | null
          scale_name: string | null
        }
        Insert: {
          maximum?: string | null
          minimum?: string | null
          scale_id?: string | null
          scale_name?: string | null
        }
        Update: {
          maximum?: string | null
          minimum?: string | null
          scale_id?: string | null
          scale_name?: string | null
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
          data_value: string | null
          date: string | null
          domain_source: string | null
          element_id: string | null
          element_name: string | null
          lower_ci_bound: string | null
          n: string | null
          not_relevant: string | null
          o_net_soc_code: string | null
          recommend_suppress: string | null
          scale_id: string | null
          standard_error: string | null
          upper_ci_bound: string | null
        }
        Insert: {
          data_value?: string | null
          date?: string | null
          domain_source?: string | null
          element_id?: string | null
          element_name?: string | null
          lower_ci_bound?: string | null
          n?: string | null
          not_relevant?: string | null
          o_net_soc_code?: string | null
          recommend_suppress?: string | null
          scale_id?: string | null
          standard_error?: string | null
          upper_ci_bound?: string | null
        }
        Update: {
          data_value?: string | null
          date?: string | null
          domain_source?: string | null
          element_id?: string | null
          element_name?: string | null
          lower_ci_bound?: string | null
          n?: string | null
          not_relevant?: string | null
          o_net_soc_code?: string | null
          recommend_suppress?: string | null
          scale_id?: string | null
          standard_error?: string | null
          upper_ci_bound?: string | null
        }
        Relationships: []
      }
      skills_to_work_activities: {
        Row: {
          skills_element_id: string | null
          skills_element_name: string | null
          work_activities_element_id: string | null
          work_activities_element_name: string | null
        }
        Insert: {
          skills_element_id?: string | null
          skills_element_name?: string | null
          work_activities_element_id?: string | null
          work_activities_element_name?: string | null
        }
        Update: {
          skills_element_id?: string | null
          skills_element_name?: string | null
          work_activities_element_id?: string | null
          work_activities_element_name?: string | null
        }
        Relationships: []
      }
      skills_to_work_context: {
        Row: {
          skills_element_id: string | null
          skills_element_name: string | null
          work_context_element_id: string | null
          work_context_element_name: string | null
        }
        Insert: {
          skills_element_id?: string | null
          skills_element_name?: string | null
          work_context_element_id?: string | null
          work_context_element_name?: string | null
        }
        Update: {
          skills_element_id?: string | null
          skills_element_name?: string | null
          work_context_element_id?: string | null
          work_context_element_name?: string | null
        }
        Relationships: []
      }
      survey_booklet_locations: {
        Row: {
          element_id: string | null
          element_name: string | null
          scale_id: string | null
          survey_item_number: string | null
        }
        Insert: {
          element_id?: string | null
          element_name?: string | null
          scale_id?: string | null
          survey_item_number?: string | null
        }
        Update: {
          element_id?: string | null
          element_name?: string | null
          scale_id?: string | null
          survey_item_number?: string | null
        }
        Relationships: []
      }
      task_categories: {
        Row: {
          category: string | null
          category_description: string | null
          scale_id: string | null
        }
        Insert: {
          category?: string | null
          category_description?: string | null
          scale_id?: string | null
        }
        Update: {
          category?: string | null
          category_description?: string | null
          scale_id?: string | null
        }
        Relationships: []
      }
      task_ratings: {
        Row: {
          category: string | null
          data_value: string | null
          date: string | null
          domain_source: string | null
          lower_ci_bound: string | null
          n: string | null
          o_net_soc_code: string | null
          recommend_suppress: string | null
          scale_id: string | null
          standard_error: string | null
          task_id: string | null
          upper_ci_bound: string | null
        }
        Insert: {
          category?: string | null
          data_value?: string | null
          date?: string | null
          domain_source?: string | null
          lower_ci_bound?: string | null
          n?: string | null
          o_net_soc_code?: string | null
          recommend_suppress?: string | null
          scale_id?: string | null
          standard_error?: string | null
          task_id?: string | null
          upper_ci_bound?: string | null
        }
        Update: {
          category?: string | null
          data_value?: string | null
          date?: string | null
          domain_source?: string | null
          lower_ci_bound?: string | null
          n?: string | null
          o_net_soc_code?: string | null
          recommend_suppress?: string | null
          scale_id?: string | null
          standard_error?: string | null
          task_id?: string | null
          upper_ci_bound?: string | null
        }
        Relationships: []
      }
      task_statements: {
        Row: {
          date: string | null
          domain_source: string | null
          incumbents_responding: string | null
          o_net_soc_code: string | null
          task: string | null
          task_id: string | null
          task_type: string | null
        }
        Insert: {
          date?: string | null
          domain_source?: string | null
          incumbents_responding?: string | null
          o_net_soc_code?: string | null
          task?: string | null
          task_id?: string | null
          task_type?: string | null
        }
        Update: {
          date?: string | null
          domain_source?: string | null
          incumbents_responding?: string | null
          o_net_soc_code?: string | null
          task?: string | null
          task_id?: string | null
          task_type?: string | null
        }
        Relationships: []
      }
      tasks_to_dwas: {
        Row: {
          date: string | null
          domain_source: string | null
          dwa_id: string | null
          o_net_soc_code: string | null
          task_id: string | null
        }
        Insert: {
          date?: string | null
          domain_source?: string | null
          dwa_id?: string | null
          o_net_soc_code?: string | null
          task_id?: string | null
        }
        Update: {
          date?: string | null
          domain_source?: string | null
          dwa_id?: string | null
          o_net_soc_code?: string | null
          task_id?: string | null
        }
        Relationships: []
      }
      technology_skills: {
        Row: {
          commodity_code: string | null
          commodity_title: string | null
          example: string | null
          hot_technology: string | null
          in_demand: string | null
          o_net_soc_code: string | null
        }
        Insert: {
          commodity_code?: string | null
          commodity_title?: string | null
          example?: string | null
          hot_technology?: string | null
          in_demand?: string | null
          o_net_soc_code?: string | null
        }
        Update: {
          commodity_code?: string | null
          commodity_title?: string | null
          example?: string | null
          hot_technology?: string | null
          in_demand?: string | null
          o_net_soc_code?: string | null
        }
        Relationships: []
      }
      tools_used: {
        Row: {
          commodity_code: string | null
          commodity_title: string | null
          example: string | null
          o_net_soc_code: string | null
        }
        Insert: {
          commodity_code?: string | null
          commodity_title?: string | null
          example?: string | null
          o_net_soc_code?: string | null
        }
        Update: {
          commodity_code?: string | null
          commodity_title?: string | null
          example?: string | null
          o_net_soc_code?: string | null
        }
        Relationships: []
      }
      unspsc_reference: {
        Row: {
          class_code: string | null
          class_title: string | null
          commodity_code: string | null
          commodity_title: string | null
          family_code: string | null
          family_title: string | null
          segment_code: string | null
          segment_title: string | null
        }
        Insert: {
          class_code?: string | null
          class_title?: string | null
          commodity_code?: string | null
          commodity_title?: string | null
          family_code?: string | null
          family_title?: string | null
          segment_code?: string | null
          segment_title?: string | null
        }
        Update: {
          class_code?: string | null
          class_title?: string | null
          commodity_code?: string | null
          commodity_title?: string | null
          family_code?: string | null
          family_title?: string | null
          segment_code?: string | null
          segment_title?: string | null
        }
        Relationships: []
      }
      work_activities: {
        Row: {
          data_value: string | null
          date: string | null
          domain_source: string | null
          element_id: string | null
          element_name: string | null
          lower_ci_bound: string | null
          n: string | null
          not_relevant: string | null
          o_net_soc_code: string | null
          recommend_suppress: string | null
          scale_id: string | null
          standard_error: string | null
          upper_ci_bound: string | null
        }
        Insert: {
          data_value?: string | null
          date?: string | null
          domain_source?: string | null
          element_id?: string | null
          element_name?: string | null
          lower_ci_bound?: string | null
          n?: string | null
          not_relevant?: string | null
          o_net_soc_code?: string | null
          recommend_suppress?: string | null
          scale_id?: string | null
          standard_error?: string | null
          upper_ci_bound?: string | null
        }
        Update: {
          data_value?: string | null
          date?: string | null
          domain_source?: string | null
          element_id?: string | null
          element_name?: string | null
          lower_ci_bound?: string | null
          n?: string | null
          not_relevant?: string | null
          o_net_soc_code?: string | null
          recommend_suppress?: string | null
          scale_id?: string | null
          standard_error?: string | null
          upper_ci_bound?: string | null
        }
        Relationships: []
      }
      work_context: {
        Row: {
          category: string | null
          data_value: string | null
          date: string | null
          domain_source: string | null
          element_id: string | null
          element_name: string | null
          lower_ci_bound: string | null
          n: string | null
          not_relevant: string | null
          o_net_soc_code: string | null
          recommend_suppress: string | null
          scale_id: string | null
          standard_error: string | null
          upper_ci_bound: string | null
        }
        Insert: {
          category?: string | null
          data_value?: string | null
          date?: string | null
          domain_source?: string | null
          element_id?: string | null
          element_name?: string | null
          lower_ci_bound?: string | null
          n?: string | null
          not_relevant?: string | null
          o_net_soc_code?: string | null
          recommend_suppress?: string | null
          scale_id?: string | null
          standard_error?: string | null
          upper_ci_bound?: string | null
        }
        Update: {
          category?: string | null
          data_value?: string | null
          date?: string | null
          domain_source?: string | null
          element_id?: string | null
          element_name?: string | null
          lower_ci_bound?: string | null
          n?: string | null
          not_relevant?: string | null
          o_net_soc_code?: string | null
          recommend_suppress?: string | null
          scale_id?: string | null
          standard_error?: string | null
          upper_ci_bound?: string | null
        }
        Relationships: []
      }
      work_context_categories: {
        Row: {
          category: string | null
          category_description: string | null
          element_id: string | null
          element_name: string | null
          scale_id: string | null
        }
        Insert: {
          category?: string | null
          category_description?: string | null
          element_id?: string | null
          element_name?: string | null
          scale_id?: string | null
        }
        Update: {
          category?: string | null
          category_description?: string | null
          element_id?: string | null
          element_name?: string | null
          scale_id?: string | null
        }
        Relationships: []
      }
      work_styles: {
        Row: {
          data_value: string | null
          date: string | null
          domain_source: string | null
          element_id: string | null
          element_name: string | null
          o_net_soc_code: string | null
          scale_id: string | null
        }
        Insert: {
          data_value?: string | null
          date?: string | null
          domain_source?: string | null
          element_id?: string | null
          element_name?: string | null
          o_net_soc_code?: string | null
          scale_id?: string | null
        }
        Update: {
          data_value?: string | null
          date?: string | null
          domain_source?: string | null
          element_id?: string | null
          element_name?: string | null
          o_net_soc_code?: string | null
          scale_id?: string | null
        }
        Relationships: []
      }
      work_values: {
        Row: {
          data_value: string | null
          date: string | null
          domain_source: string | null
          element_id: string | null
          element_name: string | null
          o_net_soc_code: string | null
          scale_id: string | null
        }
        Insert: {
          data_value?: string | null
          date?: string | null
          domain_source?: string | null
          element_id?: string | null
          element_name?: string | null
          o_net_soc_code?: string | null
          scale_id?: string | null
        }
        Update: {
          data_value?: string | null
          date?: string | null
          domain_source?: string | null
          element_id?: string | null
          element_name?: string | null
          o_net_soc_code?: string | null
          scale_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      onet_exec: { Args: { stmt: string }; Returns: undefined }
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
