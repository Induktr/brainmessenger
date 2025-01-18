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
          id: string
          email: string | null
          username: string
          display_name: string
          bio: string
          visibility: 'public' | 'private'
          avatar_url: string | null
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          username: string
          display_name: string
          bio?: string
          visibility?: 'public' | 'private'
          avatar_url?: string | null
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          username?: string
          display_name?: string
          bio?: string
          visibility?: 'public' | 'private'
          avatar_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
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
            referencedRelation: "users"
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
            referencedRelation: "profiles"
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
}

// Helper type for RPC functions
export type RPCFunctions = Database['public']['Functions']
export type RPCArgs<T extends keyof RPCFunctions> = RPCFunctions[T]['Args']
export type RPCReturns<T extends keyof RPCFunctions> = RPCFunctions[T]['Returns']
