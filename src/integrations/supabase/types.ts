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
      chat_members: {
        Row: {
          chat_id: string
          created_at: string | null
          id: string
          profile_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string | null
          id?: string
          profile_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string | null
          id?: string
          profile_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      chats: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_group: boolean | null
          last_message: Json | null
          name: string
          pinned: boolean | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_group?: boolean | null
          last_message?: Json | null
          name: string
          pinned?: boolean | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_group?: boolean | null
          last_message?: Json | null
          name?: string
          pinned?: boolean | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chats_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string | null
          id: string
          last_message: Json | null
          updated_at: string | null
          user1_id: string | null
          user2_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          last_message?: Json | null
          updated_at?: string | null
          user1_id?: string | null
          user2_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          last_message?: Json | null
          updated_at?: string | null
          user1_id?: string | null
          user2_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user1_id_fkey"
            columns: ["user1_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user2_id_fkey"
            columns: ["user2_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          chat_id: string | null
          content: string
          conversation_id: string | null
          created_at: string | null
          id: string
          is_read: boolean | null
          reactions: Json | null
          sender_id: string | null
          type: string | null
          updated_at: string | null
        }
        Insert: {
          chat_id?: string | null
          content: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          reactions?: Json | null
          sender_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Update: {
          chat_id?: string | null
          content?: string
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean | null
          reactions?: Json | null
          sender_id?: string | null
          type?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            isOneToOne: false
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          display_name: string | null
          email: string
          id: string
          updated_at: string | null
          username: string | null
          visibility: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          email: string
          id?: string
          updated_at?: string | null
          username?: string | null
          visibility?: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          display_name?: string | null
          email?: string
          id?: string
          updated_at?: string | null
          username?: string | null
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          language: string | null
          notification_settings: Json | null
          theme: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          language?: string | null
          notification_settings?: Json | null
          theme?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          language?: string | null
          notification_settings?: Json | null
          theme?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_sessions: {
        Row: {
          device_info: Json | null
          end_reason: string | null
          ended_at: string | null
          id: string
          ip_address: string | null
          started_at: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          device_info?: Json | null
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          started_at?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          device_info?: Json | null
          end_reason?: string | null
          ended_at?: string | null
          id?: string
          ip_address?: string | null
          started_at?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      users: {
        Row: {
          created_at: string | null
          email: string | null
          first_name: string | null
          id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          first_name?: never
          id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          first_name?: never
          id?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      generate_unique_username: {
        Args: {
          base_username: string
        }
        Returns: string
      }
      get_foreign_keys: {
        Args: {
          table_name: string
        }
        Returns: {
          column_name: string
          foreign_table_name: string
          foreign_schema_name: string
          foreign_column_name: string
        }[]
      }
      get_table_info: {
        Args: {
          p_table_name: string
        }
        Returns: {
          column_name: string
          data_type: string
          is_nullable: boolean
          column_default: string
        }[]
      }
      get_user_chats: {
        Args: {
          user_uuid: string
        }
        Returns: {
          chat_id: string
          chat_name: string
          is_group: boolean
          last_message: string
          last_message_time: string
          member_count: number
        }[]
      }
      update_profile: {
        Args: {
          profile_updates: Json
          timestamp_param: string
        }
        Returns: Json
      }
      update_profile_settings: {
        Args: {
          user_id: string
          new_username: string
          new_display_name: string
          new_bio: string
          new_visibility: string
        }
        Returns: Json
      }
      update_user_avatar: {
        Args: {
          user_id: string
          new_avatar_url: string
          timestamp_param: string
        }
        Returns: string
      }
    }
    Enums: {
      message_type: "text" | "image" | "audio" | "video"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (PublicSchema["Tables"] & PublicSchema["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (PublicSchema["Tables"] &
        PublicSchema["Views"])
    ? (PublicSchema["Tables"] &
        PublicSchema["Views"])[PublicTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof PublicSchema["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof PublicSchema["Tables"]
    ? PublicSchema["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof PublicSchema["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof PublicSchema["Enums"]
    ? PublicSchema["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof PublicSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof PublicSchema["CompositeTypes"]
    ? PublicSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
