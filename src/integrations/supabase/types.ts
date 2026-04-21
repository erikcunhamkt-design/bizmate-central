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
      audit_logs: {
        Row: {
          action: string
          created_at: string
          details: Json
          entity_id: string | null
          entity_type: string
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type: string
          id?: string
          reason: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: Json
          entity_id?: string | null
          entity_type?: string
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      calendar_events: {
        Row: {
          cor: string
          created_at: string
          data: string
          descricao: string | null
          hora: string | null
          id: string
          recorrencia: string | null
          recorrencia_fim: string | null
          titulo: string
          user_id: string
        }
        Insert: {
          cor?: string
          created_at?: string
          data: string
          descricao?: string | null
          hora?: string | null
          id?: string
          recorrencia?: string | null
          recorrencia_fim?: string | null
          titulo: string
          user_id: string
        }
        Update: {
          cor?: string
          created_at?: string
          data?: string
          descricao?: string | null
          hora?: string | null
          id?: string
          recorrencia?: string | null
          recorrencia_fim?: string | null
          titulo?: string
          user_id?: string
        }
        Relationships: []
      }
      cash_movements: {
        Row: {
          created_at: string
          data: string
          descricao: string | null
          id: string
          origem: string
          ref_id: string | null
          tipo: string
          user_id: string
          valor: number
        }
        Insert: {
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          origem: string
          ref_id?: string | null
          tipo: string
          user_id: string
          valor: number
        }
        Update: {
          created_at?: string
          data?: string
          descricao?: string | null
          id?: string
          origem?: string
          ref_id?: string | null
          tipo?: string
          user_id?: string
          valor?: number
        }
        Relationships: []
      }
      customer_payments: {
        Row: {
          created_at: string
          customer_id: string
          data_pagamento: string
          id: string
          metodo_recebimento: string
          observacoes: string | null
          sale_id: string | null
          user_id: string
          valor_total: number
        }
        Insert: {
          created_at?: string
          customer_id: string
          data_pagamento?: string
          id?: string
          metodo_recebimento?: string
          observacoes?: string | null
          sale_id?: string | null
          user_id: string
          valor_total: number
        }
        Update: {
          created_at?: string
          customer_id?: string
          data_pagamento?: string
          id?: string
          metodo_recebimento?: string
          observacoes?: string | null
          sale_id?: string | null
          user_id?: string
          valor_total?: number
        }
        Relationships: []
      }
      customers: {
        Row: {
          cpf: string | null
          created_at: string
          email: string | null
          endereco: string | null
          foto_url: string | null
          id: string
          nome: string
          observacoes: string | null
          status: string
          updated_at: string
          user_id: string
          whatsapp: string | null
        }
        Insert: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          foto_url?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          status?: string
          updated_at?: string
          user_id: string
          whatsapp?: string | null
        }
        Update: {
          cpf?: string | null
          created_at?: string
          email?: string | null
          endereco?: string | null
          foto_url?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          whatsapp?: string | null
        }
        Relationships: []
      }
      expenses: {
        Row: {
          categoria: string
          created_at: string
          descricao: string
          id: string
          observacoes: string | null
          pago_em: string | null
          recorrencia_tipo: string | null
          recorrente: boolean
          status: string
          user_id: string
          valor: number
          vencimento_data: string
        }
        Insert: {
          categoria?: string
          created_at?: string
          descricao: string
          id?: string
          observacoes?: string | null
          pago_em?: string | null
          recorrencia_tipo?: string | null
          recorrente?: boolean
          status?: string
          user_id: string
          valor: number
          vencimento_data: string
        }
        Update: {
          categoria?: string
          created_at?: string
          descricao?: string
          id?: string
          observacoes?: string | null
          pago_em?: string | null
          recorrencia_tipo?: string | null
          recorrente?: boolean
          status?: string
          user_id?: string
          valor?: number
          vencimento_data?: string
        }
        Relationships: []
      }
      installments: {
        Row: {
          created_at: string
          customer_id: string
          id: string
          lembrete_enviado_em: string | null
          metodo_recebimento: string | null
          numero_parcela: number
          pago_em: string | null
          pago_valor: number | null
          sale_id: string | null
          status: string
          total_parcelas: number
          user_id: string
          valor_parcela: number
          vencimento_data: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          id?: string
          lembrete_enviado_em?: string | null
          metodo_recebimento?: string | null
          numero_parcela?: number
          pago_em?: string | null
          pago_valor?: number | null
          sale_id?: string | null
          status?: string
          total_parcelas?: number
          user_id: string
          valor_parcela: number
          vencimento_data: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          id?: string
          lembrete_enviado_em?: string | null
          metodo_recebimento?: string | null
          numero_parcela?: number
          pago_em?: string | null
          pago_valor?: number | null
          sale_id?: string | null
          status?: string
          total_parcelas?: number
          user_id?: string
          valor_parcela?: number
          vencimento_data?: string
        }
        Relationships: [
          {
            foreignKeyName: "installments_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "installments_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_allocations: {
        Row: {
          created_at: string
          id: string
          installment_id: string
          payment_id: string
          tipo: string
          user_id: string
          valor_aplicado: number
        }
        Insert: {
          created_at?: string
          id?: string
          installment_id: string
          payment_id: string
          tipo?: string
          user_id: string
          valor_aplicado: number
        }
        Update: {
          created_at?: string
          id?: string
          installment_id?: string
          payment_id?: string
          tipo?: string
          user_id?: string
          valor_aplicado?: number
        }
        Relationships: [
          {
            foreignKeyName: "payment_allocations_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: false
            referencedRelation: "customer_payments"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          alerta_estoque_minimo: number
          categoria: string | null
          created_at: string
          custo_unitario: number
          estoque_atual: number
          foto_url: string | null
          id: string
          margem_alvo_percent: number | null
          nome: string
          preco_minimo: number | null
          preco_padrao: number
          sku: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alerta_estoque_minimo?: number
          categoria?: string | null
          created_at?: string
          custo_unitario?: number
          estoque_atual?: number
          foto_url?: string | null
          id?: string
          margem_alvo_percent?: number | null
          nome: string
          preco_minimo?: number | null
          preco_padrao?: number
          sku?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alerta_estoque_minimo?: number
          categoria?: string | null
          created_at?: string
          custo_unitario?: number
          estoque_atual?: number
          foto_url?: string | null
          id?: string
          margem_alvo_percent?: number | null
          nome?: string
          preco_minimo?: number | null
          preco_padrao?: number
          sku?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      revenue_goals: {
        Row: {
          ano: number
          created_at: string
          id: string
          mes: number
          meta_valor: number
          updated_at: string
          user_id: string
        }
        Insert: {
          ano: number
          created_at?: string
          id?: string
          mes: number
          meta_valor?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          ano?: number
          created_at?: string
          id?: string
          mes?: number
          meta_valor?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          custo_unitario_no_momento: number
          id: string
          preco_unitario_vendido: number
          product_id: string
          quantidade: number
          sale_id: string
          subtotal: number
        }
        Insert: {
          custo_unitario_no_momento?: number
          id?: string
          preco_unitario_vendido: number
          product_id: string
          quantidade?: number
          sale_id: string
          subtotal: number
        }
        Update: {
          custo_unitario_no_momento?: number
          id?: string
          preco_unitario_vendido?: number
          product_id?: string
          quantidade?: number
          sale_id?: string
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          created_at: string
          customer_id: string
          data_compra: string
          desconto_total: number
          forma_pagamento: string
          id: string
          observacoes: string | null
          status: string
          total_venda: number
          user_id: string
        }
        Insert: {
          created_at?: string
          customer_id: string
          data_compra?: string
          desconto_total?: number
          forma_pagamento?: string
          id?: string
          observacoes?: string | null
          status?: string
          total_venda?: number
          user_id: string
        }
        Update: {
          created_at?: string
          customer_id?: string
          data_compra?: string
          desconto_total?: number
          forma_pagamento?: string
          id?: string
          observacoes?: string | null
          status?: string
          total_venda?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sales_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_movements: {
        Row: {
          created_at: string
          estoque_anterior: number
          estoque_posterior: number
          id: string
          motivo: string | null
          product_id: string
          quantidade: number
          tipo: string
          user_id: string
        }
        Insert: {
          created_at?: string
          estoque_anterior: number
          estoque_posterior: number
          id?: string
          motivo?: string | null
          product_id: string
          quantidade: number
          tipo: string
          user_id: string
        }
        Update: {
          created_at?: string
          estoque_anterior?: number
          estoque_posterior?: number
          id?: string
          motivo?: string | null
          product_id?: string
          quantidade?: number
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
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
