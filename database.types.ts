export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  public: {
    Tables: {
      alarm: {
        Row: {
          created_at: string
          id: string
          last_notification_id: string | null
          next_alarm_time: string | null
          page_id: string
          processed_at: string | null
          sent_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          last_notification_id?: string | null
          next_alarm_time?: string | null
          page_id: string
          processed_at?: string | null
          sent_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          last_notification_id?: string | null
          next_alarm_time?: string | null
          page_id?: string
          processed_at?: string | null
          sent_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "alarm_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: true
            referencedRelation: "page"
            referencedColumns: ["id"]
          },
        ]
      }
      alarm_deleted: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      api_type: {
        Row: {
          call_price: number
          created_at: string | null
          currency: string
          description: string | null
          id: number
          name: string
          price: number
          vendor_id: number | null
          version: string | null
        }
        Insert: {
          call_price?: number
          created_at?: string | null
          currency: string
          description?: string | null
          id: number
          name: string
          price: number
          vendor_id?: number | null
          version?: string | null
        }
        Update: {
          call_price?: number
          created_at?: string | null
          currency?: string
          description?: string | null
          id?: number
          name?: string
          price?: number
          vendor_id?: number | null
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_types_vendor_id_fkey"
            columns: ["vendor_id"]
            isOneToOne: false
            referencedRelation: "api_vendors"
            referencedColumns: ["id"]
          },
        ]
      }
      api_usage_purpose: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id: number
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      api_vendors: {
        Row: {
          created_at: string | null
          description: string | null
          id: number
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id: number
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      beta_tester: {
        Row: {
          accepted: boolean | null
          created_at: string
          id: number
          registered_at: string | null
          user_id: string | null
        }
        Insert: {
          accepted?: boolean | null
          created_at?: string
          id?: number
          registered_at?: string | null
          user_id?: string | null
        }
        Update: {
          accepted?: boolean | null
          created_at?: string
          id?: number
          registered_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      custom_prompts: {
        Row: {
          body_prompt: string | null
          extra_prompt: string | null
          extra_prompt_1: string | null
          extra_prompt_2: string | null
          extra_prompt_3: string | null
          ocr_prompt: string | null
          photo_prompt: string | null
          reminder_prompt: string | null
          title_prompt: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body_prompt?: string | null
          extra_prompt?: string | null
          extra_prompt_1?: string | null
          extra_prompt_2?: string | null
          extra_prompt_3?: string | null
          ocr_prompt?: string | null
          photo_prompt?: string | null
          reminder_prompt?: string | null
          title_prompt?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          body_prompt?: string | null
          extra_prompt?: string | null
          extra_prompt_1?: string | null
          extra_prompt_2?: string | null
          extra_prompt_3?: string | null
          ocr_prompt?: string | null
          photo_prompt?: string | null
          reminder_prompt?: string | null
          title_prompt?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      documents: {
        Row: {
          content: string | null
          embedding: string | null
          id: number
          is_public: boolean | null
          metadata: Json | null
          page_id: string | null
          user_id: string | null
        }
        Insert: {
          content?: string | null
          embedding?: string | null
          id?: number
          is_public?: boolean | null
          metadata?: Json | null
          page_id?: string | null
          user_id?: string | null
        }
        Update: {
          content?: string | null
          embedding?: string | null
          id?: number
          is_public?: boolean | null
          metadata?: Json | null
          page_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "documents_page_id_fkey"
            columns: ["page_id"]
            isOneToOne: false
            referencedRelation: "page"
            referencedColumns: ["id"]
          },
        ]
      }
      folder: {
        Row: {
          created_at: string
          description: string | null
          id: string
          last_page_added_at: string | null
          name: string
          page_count: number
          thumbnail_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id: string
          last_page_added_at?: string | null
          name: string
          page_count?: number
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          last_page_added_at?: string | null
          name?: string
          page_count?: number
          thumbnail_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      folder_deleted: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      job_queue: {
        Row: {
          created_at: string | null
          id: string
          job_name: string | null
          last_running_at: string | null
          payload: string | null
          scheduled_time: string
          status: Database["public"]["Enums"]["job_status"] | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          job_name?: string | null
          last_running_at?: string | null
          payload?: string | null
          scheduled_time?: string
          status?: Database["public"]["Enums"]["job_status"] | null
          user_id?: string
        }
        Update: {
          created_at?: string | null
          id?: string
          job_name?: string | null
          last_running_at?: string | null
          payload?: string | null
          scheduled_time?: string
          status?: Database["public"]["Enums"]["job_status"] | null
          user_id?: string
        }
        Relationships: []
      }
      page: {
        Row: {
          body: string
          child_count: number | null
          created_at: string
          folder_id: string | null
          id: string
          img_url: string | null
          is_public: boolean | null
          last_embedded_at: string | null
          last_viewed_at: string | null
          length: number | null
          parent_count: number | null
          title: string
          type: Database["public"]["Enums"]["page_type"]
          updated_at: string | null
          user_id: string
        }
        Insert: {
          body: string
          child_count?: number | null
          created_at?: string
          folder_id?: string | null
          id: string
          img_url?: string | null
          is_public?: boolean | null
          last_embedded_at?: string | null
          last_viewed_at?: string | null
          length?: number | null
          parent_count?: number | null
          title: string
          type?: Database["public"]["Enums"]["page_type"]
          updated_at?: string | null
          user_id?: string
        }
        Update: {
          body?: string
          child_count?: number | null
          created_at?: string
          folder_id?: string | null
          id?: string
          img_url?: string | null
          is_public?: boolean | null
          last_embedded_at?: string | null
          last_viewed_at?: string | null
          length?: number | null
          parent_count?: number | null
          title?: string
          type?: Database["public"]["Enums"]["page_type"]
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "page_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folder"
            referencedColumns: ["id"]
          },
        ]
      }
      page_deleted: {
        Row: {
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      product_payment_type_price: {
        Row: {
          amount: number
          created_at: string
          end_date: string | null
          id: number
          product_payment_type_id: number
        }
        Insert: {
          amount: number
          created_at?: string
          end_date?: string | null
          id?: number
          product_payment_type_id: number
        }
        Update: {
          amount?: number
          created_at?: string
          end_date?: string | null
          id?: number
          product_payment_type_id?: number
        }
        Relationships: []
      }
      superuser: {
        Row: {
          user_id: string
        }
        Insert: {
          user_id: string
        }
        Update: {
          user_id?: string
        }
        Relationships: []
      }
      user_info: {
        Row: {
          created_at: string
          id: number
          marketing_consent_update_at: string | null
          marketing_consent_version: string | null
          nickname: string | null
          privacy_policy_consent_updated_at: string | null
          privacy_policy_consent_version: string | null
          profile_img_url: string | null
          terms_of_service_consent_update_at: string | null
          terms_of_service_consent_version: string | null
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          marketing_consent_update_at?: string | null
          marketing_consent_version?: string | null
          nickname?: string | null
          privacy_policy_consent_updated_at?: string | null
          privacy_policy_consent_version?: string | null
          profile_img_url?: string | null
          terms_of_service_consent_update_at?: string | null
          terms_of_service_consent_version?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: number
          marketing_consent_update_at?: string | null
          marketing_consent_version?: string | null
          nickname?: string | null
          privacy_policy_consent_updated_at?: string | null
          privacy_policy_consent_version?: string | null
          profile_img_url?: string | null
          terms_of_service_consent_update_at?: string | null
          terms_of_service_consent_version?: string | null
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      pg_all_foreign_keys: {
        Row: {
          fk_columns: unknown[] | null
          fk_constraint_name: unknown
          fk_schema_name: unknown
          fk_table_name: unknown
          fk_table_oid: unknown
          is_deferrable: boolean | null
          is_deferred: boolean | null
          match_type: string | null
          on_delete: string | null
          on_update: string | null
          pk_columns: unknown[] | null
          pk_constraint_name: unknown
          pk_index_name: unknown
          pk_schema_name: unknown
          pk_table_name: unknown
          pk_table_oid: unknown
        }
        Relationships: []
      }
      tap_funky: {
        Row: {
          args: string | null
          is_definer: boolean | null
          is_strict: boolean | null
          is_visible: boolean | null
          kind: unknown
          langoid: unknown
          name: unknown
          oid: unknown
          owner: unknown
          returns: string | null
          returns_set: boolean | null
          schema: unknown
          volatility: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      _cleanup: { Args: never; Returns: boolean }
      _contract_on: { Args: { "": string }; Returns: unknown }
      _currtest: { Args: never; Returns: number }
      _db_privs: { Args: never; Returns: unknown[] }
      _extensions: { Args: never; Returns: unknown[] }
      _get: { Args: { "": string }; Returns: number }
      _get_latest: { Args: { "": string }; Returns: number[] }
      _get_note: { Args: { "": string }; Returns: string }
      _is_verbose: { Args: never; Returns: boolean }
      _prokind: { Args: { p_oid: unknown }; Returns: unknown }
      _query: { Args: { "": string }; Returns: string }
      _refine_vol: { Args: { "": string }; Returns: string }
      _table_privs: { Args: never; Returns: unknown[] }
      _temptypes: { Args: { "": string }; Returns: string }
      _todo: { Args: never; Returns: string }
      adjust_for_sleep_time: {
        Args: { p_time: string; p_timezone: string }
        Returns: string
      }
      attach_into_book_or_library: {
        Args: {
          p_child_id: number
          p_parent_id: number
          p_parent_type: string
          p_position: string
        }
        Returns: undefined
      }
      calculate_progressive_interval: {
        Args: { p_base_time: string; p_now: string; p_sent_count: number }
        Returns: string
      }
      change_sort_position: {
        Args: {
          p_child_source_id: number
          p_child_target_id: number
          p_parent_id: number
          p_parent_type: string
        }
        Returns: undefined
      }
      col_is_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
      col_not_null:
        | {
            Args: {
              column_name: unknown
              description?: string
              table_name: unknown
            }
            Returns: string
          }
        | {
            Args: {
              column_name: unknown
              description?: string
              schema_name: unknown
              table_name: unknown
            }
            Returns: string
          }
      diag:
        | {
            Args: { msg: unknown }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
        | {
            Args: { msg: string }
            Returns: {
              error: true
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved"
          }
      diag_test_name: { Args: { "": string }; Returns: string }
      do_tap:
        | { Args: { "": string }; Returns: string[] }
        | { Args: never; Returns: string[] }
      fail:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      findfuncs: { Args: { "": string }; Returns: string[] }
      finish: { Args: { exception_on_failure?: boolean }; Returns: string[] }
      get_dynamic_pages_chunk: {
        Args: {
          last_created_at: string
          last_id: string
          max_limit?: number
          target_size?: number
        }
        Returns: Json
      }
      get_page_parents: {
        Args: { page_id: number }
        Returns: {
          id: number
          meta: Json
          parent_page_id: number
          path: string
        }[]
      }
      has_unique: { Args: { "": string }; Returns: string }
      in_todo: { Args: never; Returns: boolean }
      is_empty: { Args: { "": string }; Returns: string }
      isnt_empty: { Args: { "": string }; Returns: string }
      lives_ok: { Args: { "": string }; Returns: string }
      match_documents: {
        Args: {
          input_page_id?: string
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          content: string
          id: number
          metadata: Json
          page_id: string
          similarity: number
        }[]
      }
      match_page_sections: {
        Args: {
          embedding: string
          match_count: number
          match_threshold: number
          min_content_length: number
        }
        Returns: {
          content: string
          heading: string
          id: number
          page_id: number
          similarity: number
          slug: string
        }[]
      }
      match_pages: {
        Args: {
          exclude_id: number
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          body: string
          id: number
          similarity: number
          title: string
        }[]
      }
      match_topics: {
        Args: {
          match_count: number
          match_threshold: number
          query_embedding: string
        }
        Returns: {
          body: string
          id: number
          similarity: number
          title: string
        }[]
      }
      no_plan: { Args: never; Returns: boolean[] }
      num_failed: { Args: never; Returns: number }
      os_name: { Args: never; Returns: string }
      pass:
        | { Args: never; Returns: string }
        | { Args: { "": string }; Returns: string }
      pg_version: { Args: never; Returns: string }
      pg_version_num: { Args: never; Returns: number }
      pgtap_version: { Args: never; Returns: number }
      process_alarms_atomically: {
        Args: { p_batch_limit?: number; p_current_time?: string }
        Returns: {
          alarm_id: string
          body: string
          error_reason: string
          new_next_alarm_time: string
          old_next_alarm_time: string
          page_id: string
          processing_time_ms: number
          sent_count: number
          timezone: string
          title: string
          user_id: string
        }[]
      }
      runtests:
        | { Args: never; Returns: string[] }
        | { Args: { "": string }; Returns: string[] }
      search_page: {
        Args: {
          additional_condition?: string
          keyword: string
          limit_result?: number
          offset_result?: number
          order_by?: string
        }
        Returns: {
          body: string
          created_at: string
          id: number
          is_public: boolean
          title: string
          user_id: string
        }[]
      }
      set_quota: {
        Args: {
          p_api_type_id: number
          p_free_plan_limit: number
          p_subscription_plan_limit: number
          p_usage_amount: number
          p_user_id: string
        }
        Returns: undefined
      }
      skip:
        | { Args: { how_many: number; why: string }; Returns: string }
        | { Args: { "": string }; Returns: string }
      throws_ok: { Args: { "": string }; Returns: string }
      todo:
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
        | { Args: { how_many: number }; Returns: boolean[] }
        | { Args: { why: string }; Returns: boolean[] }
      todo_end: { Args: never; Returns: boolean[] }
      todo_start:
        | { Args: { "": string }; Returns: boolean[] }
        | { Args: never; Returns: boolean[] }
      update_last_viewed_at: { Args: { page_id: number }; Returns: undefined }
      update_notification_ids_batch: {
        Args: { p_notification_updates: Json }
        Returns: {
          failed_count: number
          updated_count: number
        }[]
      }
    }
    Enums: {
      job_status: "PENDING" | "RUNNING" | "FAIL"
      page_type: "text" | "draw"
    }
    CompositeTypes: {
      _time_trial_type: {
        a_time: number | null
      }
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
      job_status: ["PENDING", "RUNNING", "FAIL"],
      page_type: ["text", "draw"],
    },
  },
} as const

