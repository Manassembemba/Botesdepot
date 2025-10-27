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
      audit_logs: {
        Row: {
          id: number
          user_id: string | null
          action: string
          details: Json | null
          created_at: string
        }
        Insert: {
          id?: number
          user_id?: string | null
          action: string
          details?: Json | null
          created_at?: string
        }
        Update: {
          id?: number
          user_id?: string | null
          action?: string
          details?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      locker_stock: {
        Row: {
          id: number
          locker_id: number
          product_id: number
          quantity_bottles: number
          updated_at: string
        }
        Insert: {
          id?: number
          locker_id: number
          product_id: number
          quantity_bottles?: number
          updated_at?: string
        }
        Update: {
          id?: number
          locker_id?: number
          product_id?: number
          quantity_bottles?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locker_stock_locker_id_fkey"
            columns: ["locker_id"]
            isOneToOne: false
            referencedRelation: "lockers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "locker_stock_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          }
        ]
      }
      lockers: {
        Row: {
          id: number
          code: string
          name: string | null
          location: string | null
          capacity: number
          created_at: string
        }
        Insert: {
          id?: number
          code: string
          name?: string | null
          location?: string | null
          capacity?: number
          created_at?: string
        }
        Update: {
          id?: number
          code?: string
          name?: string | null
          location?: string | null
          capacity?: number
          created_at?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          id: number
          sku: string
          name: string
          description: string | null
          price_per_bottle: number
          cost_per_bottle: number | null
          bottles_per_case: number
          price_half_case: number
          price_full_case: number
          image_url: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: number
          sku: string
          name: string
          description?: string | null
          price_per_bottle: number
          cost_per_bottle?: number | null
          bottles_per_case?: number
          price_half_case?: number
          price_full_case?: number
          image_url?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: number
          sku?: string
          name?: string
          description?: string | null
          price_per_bottle?: number
          cost_per_bottle?: number | null
          bottles_per_case?: number
          price_half_case?: number
          price_full_case?: number
          image_url?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          id: string
          full_name: string
          created_at: string
        }
        Insert: {
          id: string
          full_name: string
          created_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      sales: {
        Row: {
          id: number
          reference: string
          created_by: string | null
          total_amount: number
          payment_status: string
          created_at: string
          site_id: string | null
        }
        Insert: {
          id?: number
          reference: string
          created_by?: string | null
          total_amount?: number
          payment_status?: string
          created_at?: string
          site_id?: string | null
        }
        Update: {
          id?: number
          reference?: string
          created_by?: string | null
          total_amount?: number
          payment_status?: string
          created_at?: string
          site_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_site_id_fkey"
            columns: ["site_id"]
            isOneToOne: false
            referencedRelation: "sites"
            referencedColumns: ["id"]
          }
        ]
      }
      sale_items: {
        Row: {
          id: number
          sale_id: number | null
          product_id: number | null
          locker_id: number | null
          unit_type: string
          unit_price: number
          qty: number
          qty_bottles: number
          total_price: number
          created_at: string
        }
        Insert: {
          id?: number
          sale_id?: number | null
          product_id?: number | null
          locker_id?: number | null
          unit_type: string
          unit_price: number
          qty: number
          qty_bottles: number
          total_price: number
          created_at?: string
        }
        Update: {
          id?: number
          sale_id?: number | null
          product_id?: number | null
          locker_id?: number | null
          unit_type?: string
          unit_price?: number
          qty?: number
          qty_bottles?: number
          total_price?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_locker_id_fkey"
            columns: ["locker_id"]
            isOneToOne: false
            referencedRelation: "lockers"
            referencedColumns: ["id"]
          }
        ]
      }
      sites: {
        Row: {
          id: string
          name: string
          code: string
          address: string | null
          phone: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          code: string
          address?: string | null
          phone?: string | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          code?: string
          address?: string | null
          phone?: string | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
      stock_entries: {
        Row: {
          id: number
          product_id: number | null
          qty_bottles: number
          unit_cost: number | null
          supplier: string | null
          locker_id: number | null
          received_by: string | null
          received_at: string
          note: string | null
        }
        Insert: {
          id?: number
          product_id?: number | null
          qty_bottles: number
          unit_cost?: number | null
          supplier?: string | null
          locker_id?: number | null
          received_by?: string | null
          received_at?: string
          note?: string | null
        }
        Update: {
          id?: number
          product_id?: number | null
          qty_bottles?: number
          unit_cost?: number | null
          supplier?: string | null
          locker_id?: number | null
          received_by?: string | null
          received_at?: string
          note?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "stock_entries_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_entries_locker_id_fkey"
            columns: ["locker_id"]
            isOneToOne: false
            referencedRelation: "lockers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_entries_received_by_fkey"
            columns: ["received_by"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
          created_at: string
        }
        Insert: {
          id?: string
          user_id: string
          role: Database["public"]["Enums"]["app_role"]
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          }
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      process_sale: {
        Args: {
          p_reference: string
          p_created_by: string
          p_locker_id: number
          p_items: Json
        }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "magasinier" | "client"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type Tables<
  PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
      Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
      Database["public"]["Views"])
  ? (Database["public"]["Tables"] &
      Database["public"]["Views"])[PublicTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
  ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
  ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
  EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = PublicEnumNameOrOptions extends { schema: keyof Database }
  ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
  ? Database["public"]["Enums"][PublicEnumNameOrOptions]
  : never