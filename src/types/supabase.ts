export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          visibility: "public" | "private"
          bio: string
          email: string
          avatar_url: string | null
          id: string
          updated_at: string | null
          username: string | null
          display_name: string | null
        }
        Insert: {
          visibility?: "public" | "private"
          bio?: string
          email?: string
          avatar_url?: string | null
          id: string
          updated_at?: string | null
          username?: string | null
          display_name?: string | null
        }
        Update: {
          visibility?: "public" | "private"
          bio?: string
          email?: string
          avatar_url?: string | null
          id?: string
          updated_at?: string | null
          username?: string | null
          display_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          }
        ]
      }
      chats: {
        Row: {
          id: string;
          name: string;
          is_group: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
          last_message: string | null;
          last_message_time: string | null;
          pinned: boolean;
        };
        Insert: Omit<Database['public']['Tables']['chats']['Row'], 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Database['public']['Tables']['chats']['Row']>;
      }
      messages: {
        Row: {
          id: string
          chat_id: string
          sender_id: string
          content: string
          type: string
          created_at: string
          reactions: Json
          updated_at: string
        }
        Insert: {
          id?: string
          chat_id: string
          sender_id: string
          content: string
          type: string
          created_at?: string
          reactions?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          chat_id?: string
          sender_id?: string
          content?: string
          type?: string
          created_at?: string
          reactions?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_chat_id_fkey"
            columns: ["chat_id"]
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          }
        ]
      }
      chat_members: {
        Row: {
          chat_id: string
          user_id: string
          joined_at: string
        }
        Insert: {
          chat_id: string
          user_id: string
          joined_at?: string
        }
        Update: {
          chat_id?: string
          user_id?: string
          joined_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_members_chat_id_fkey"
            columns: ["chat_id"]
            referencedRelation: "chats"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_members_user_id_fkey"
            columns: ["user_id"]
            referencedRelation: "auth.users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      update_user_avatar: {
        Args: {
          user_id: string
          new_avatar_url: string
          timestamp_param: string
        }
        Returns: string | null
      }
    } & Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
  auth: {
    Tables: {
      users: {
        Row: {
          id: string
          email?: string
          created_at: string
          updated_at: string | null
          deleted_at: string | null
          raw_app_meta_data: Json
          raw_user_meta_data: Json
          is_super_admin: boolean
          role: string
          email_confirmed_at: string | null
          phone_confirmed_at: string | null
          confirmation_sent_at: string | null
          recovery_sent_at: string | null
          email_change_sent_at: string | null
          new_email: string | null
          invited_at: string | null
          action_link: string | null
          phone: string | null
          confirmation_token: string | null
          recovery_token: string | null
          email_change_token_new: string | null
          email_change_token_current: string | null
          last_sign_in_at: string | null
          raw_confirmation_token: string | null
          raw_recovery_token: string | null
          raw_email_change_token_new: string | null
          raw_email_change_token_current: string | null
        }
        Insert: {
          id?: string
          email?: string
          created_at?: string
          updated_at?: string | null
          deleted_at?: string | null
          raw_app_meta_data?: Json
          raw_user_meta_data?: Json
          is_super_admin?: boolean
          role?: string
          email_confirmed_at?: string | null
          phone_confirmed_at?: string | null
          confirmation_sent_at?: string | null
          recovery_sent_at?: string | null
          email_change_sent_at?: string | null
          new_email?: string | null
          invited_at?: string | null
          action_link?: string | null
          phone?: string | null
          confirmation_token?: string | null
          recovery_token?: string | null
          email_change_token_new?: string | null
          email_change_token_current?: string | null
          last_sign_in_at?: string | null
          raw_confirmation_token?: string | null
          raw_recovery_token?: string | null
          raw_email_change_token_new?: string | null
          raw_email_change_token_current?: string | null
        }
        Update: {
          id?: string
          email?: string
          created_at?: string
          updated_at?: string | null
          deleted_at?: string | null
          raw_app_meta_data?: Json
          raw_user_meta_data?: Json
          is_super_admin?: boolean
          role?: string
          email_confirmed_at?: string | null
          phone_confirmed_at?: string | null
          confirmation_sent_at?: string | null
          recovery_sent_at?: string | null
          email_change_sent_at?: string | null
          new_email?: string | null
          invited_at?: string | null
          action_link?: string | null
          phone?: string | null
          confirmation_token?: string | null
          recovery_token?: string | null
          email_change_token_new?: string | null
          email_change_token_current?: string | null
          last_sign_in_at?: string | null
          raw_confirmation_token?: string | null
          raw_recovery_token?: string | null
          raw_email_change_token_new?: string | null
          raw_email_change_token_current?: string | null
        }
      }
    }
  }
}

// Helper type for RPC functions
export type RPCFunctions = Database['public']['Functions']
export type RPCArgs<T extends keyof RPCFunctions> = RPCFunctions[T]['Args']
export type RPCReturns<T extends keyof RPCFunctions> = RPCFunctions[T]['Returns']

export type Profile = Database['public']['Tables']['profiles']['Row'];
