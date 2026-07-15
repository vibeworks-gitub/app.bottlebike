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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      bb_cash_registers: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          notes: string | null
          owner_id: string
          r2o_cash_register_id: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          r2o_cash_register_id?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          r2o_cash_register_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bb_fixed_costs: {
        Row: {
          active: boolean
          amount: number
          category: string | null
          created_at: string
          description: string | null
          end_date: string | null
          frequency: string
          id: string
          name: string
          notes: string | null
          owner_id: string
          start_date: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          category?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          frequency: string
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          start_date?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          category?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          frequency?: string
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      bb_locations: {
        Row: {
          active: boolean
          created_at: string
          id: string
          name: string
          notes: string | null
          owner_id: string
          restock_source_location_id: string | null
          type: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          restock_source_location_id?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          restock_source_location_id?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_locations_restock_source_location_id_fkey"
            columns: ["restock_source_location_id"]
            isOneToOne: false
            referencedRelation: "bb_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_product_extras: {
        Row: {
          cost_includes_vat: boolean
          cost_price: number | null
          created_at: string
          custom_category: string | null
          custom_name: string | null
          deposit_product_id: number | null
          last_purchase_date: string | null
          last_purchase_price: number | null
          notes: string | null
          owner_id: string
          package_qty: number | null
          package_unit: string | null
          r2o_product_id: number
          reorder_level: number | null
          retour_for_product_id: number | null
          shelf_life_days: number | null
          stock_behavior: string
          supplier_id: string | null
          target_margin_pct: number | null
          updated_at: string
        }
        Insert: {
          cost_includes_vat?: boolean
          cost_price?: number | null
          created_at?: string
          custom_category?: string | null
          custom_name?: string | null
          deposit_product_id?: number | null
          last_purchase_date?: string | null
          last_purchase_price?: number | null
          notes?: string | null
          owner_id: string
          package_qty?: number | null
          package_unit?: string | null
          r2o_product_id: number
          reorder_level?: number | null
          retour_for_product_id?: number | null
          shelf_life_days?: number | null
          stock_behavior?: string
          supplier_id?: string | null
          target_margin_pct?: number | null
          updated_at?: string
        }
        Update: {
          cost_includes_vat?: boolean
          cost_price?: number | null
          created_at?: string
          custom_category?: string | null
          custom_name?: string | null
          deposit_product_id?: number | null
          last_purchase_date?: string | null
          last_purchase_price?: number | null
          notes?: string | null
          owner_id?: string
          package_qty?: number | null
          package_unit?: string | null
          r2o_product_id?: number
          reorder_level?: number | null
          retour_for_product_id?: number | null
          shelf_life_days?: number | null
          stock_behavior?: string
          supplier_id?: string | null
          target_margin_pct?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_product_extras_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "bb_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_purchase_items: {
        Row: {
          created_at: string
          expiry_date: string | null
          id: string
          notes: string | null
          owner_id: string
          purchase_id: string
          quantity: number
          r2o_product_id: number
          sort_order: number
          unit_cost_net: number | null
        }
        Insert: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          owner_id: string
          purchase_id: string
          quantity: number
          r2o_product_id: number
          sort_order?: number
          unit_cost_net?: number | null
        }
        Update: {
          created_at?: string
          expiry_date?: string | null
          id?: string
          notes?: string | null
          owner_id?: string
          purchase_id?: string
          quantity?: number
          r2o_product_id?: number
          sort_order?: number
          unit_cost_net?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "bb_purchase_items_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "bb_purchases"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_purchases: {
        Row: {
          created_at: string
          created_by: string | null
          destination_location_id: string
          id: string
          invoice_date: string | null
          invoice_number: string | null
          notes: string | null
          owner_id: string
          received_at: string
          status: string
          supplier_id: string | null
          total_gross: number | null
          total_net: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          destination_location_id: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          owner_id: string
          received_at?: string
          status?: string
          supplier_id?: string | null
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          destination_location_id?: string
          id?: string
          invoice_date?: string | null
          invoice_number?: string | null
          notes?: string | null
          owner_id?: string
          received_at?: string
          status?: string
          supplier_id?: string | null
          total_gross?: number | null
          total_net?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_purchases_destination_location_id_fkey"
            columns: ["destination_location_id"]
            isOneToOne: false
            referencedRelation: "bb_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_purchases_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "bb_suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_register_assignments: {
        Row: {
          cash_register_id: string
          created_at: string
          created_by: string | null
          id: string
          location_id: string
          notes: string | null
          owner_id: string
          valid_from: string
          valid_to: string | null
        }
        Insert: {
          cash_register_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          location_id: string
          notes?: string | null
          owner_id: string
          valid_from: string
          valid_to?: string | null
        }
        Update: {
          cash_register_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string
          notes?: string | null
          owner_id?: string
          valid_from?: string
          valid_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bb_register_assignments_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "bb_cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_register_assignments_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "bb_cash_registers_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_register_assignments_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "bb_unbooked_sales"
            referencedColumns: ["cash_register_id"]
          },
          {
            foreignKeyName: "bb_register_assignments_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "bb_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_shift_counts: {
        Row: {
          cleared_at: string | null
          cleared_by: string | null
          cleared_notes: string | null
          count_type: string
          counted_at: string
          counted_by: string | null
          counted_qty: number
          expected_qty: number | null
          id: string
          notes: string | null
          owner_id: string
          r2o_product_id: number
          shift_id: string
        }
        Insert: {
          cleared_at?: string | null
          cleared_by?: string | null
          cleared_notes?: string | null
          count_type: string
          counted_at?: string
          counted_by?: string | null
          counted_qty: number
          expected_qty?: number | null
          id?: string
          notes?: string | null
          owner_id: string
          r2o_product_id: number
          shift_id: string
        }
        Update: {
          cleared_at?: string | null
          cleared_by?: string | null
          cleared_notes?: string | null
          count_type?: string
          counted_at?: string
          counted_by?: string | null
          counted_qty?: number
          expected_qty?: number | null
          id?: string
          notes?: string | null
          owner_id?: string
          r2o_product_id?: number
          shift_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_shift_counts_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "bb_shifts"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_shifts: {
        Row: {
          cash_register_id: string | null
          created_at: string
          created_by: string | null
          end_cash_eur: number | null
          end_notes: string | null
          ended_at: string | null
          id: string
          location_id: string
          owner_id: string
          r2o_user_id: number | null
          start_cash_eur: number | null
          start_notes: string | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          cash_register_id?: string | null
          created_at?: string
          created_by?: string | null
          end_cash_eur?: number | null
          end_notes?: string | null
          ended_at?: string | null
          id?: string
          location_id: string
          owner_id: string
          r2o_user_id?: number | null
          start_cash_eur?: number | null
          start_notes?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          cash_register_id?: string | null
          created_at?: string
          created_by?: string | null
          end_cash_eur?: number | null
          end_notes?: string | null
          ended_at?: string | null
          id?: string
          location_id?: string
          owner_id?: string
          r2o_user_id?: number | null
          start_cash_eur?: number | null
          start_notes?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_shifts_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "bb_cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_shifts_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "bb_cash_registers_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_shifts_cash_register_id_fkey"
            columns: ["cash_register_id"]
            isOneToOne: false
            referencedRelation: "bb_unbooked_sales"
            referencedColumns: ["cash_register_id"]
          },
          {
            foreignKeyName: "bb_shifts_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "bb_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_staff_costs: {
        Row: {
          active: boolean
          commission_pct: number | null
          created_at: string
          display_name: string
          employer_cost_factor: number | null
          end_date: string | null
          hourly_rate: number | null
          hours_per_week: number | null
          id: string
          monthly_salary: number | null
          notes: string | null
          owner_id: string
          r2o_user_id: number | null
          role: string | null
          start_date: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          commission_pct?: number | null
          created_at?: string
          display_name: string
          employer_cost_factor?: number | null
          end_date?: string | null
          hourly_rate?: number | null
          hours_per_week?: number | null
          id?: string
          monthly_salary?: number | null
          notes?: string | null
          owner_id: string
          r2o_user_id?: number | null
          role?: string | null
          start_date?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          commission_pct?: number | null
          created_at?: string
          display_name?: string
          employer_cost_factor?: number | null
          end_date?: string | null
          hourly_rate?: number | null
          hours_per_week?: number | null
          id?: string
          monthly_salary?: number | null
          notes?: string | null
          owner_id?: string
          r2o_user_id?: number | null
          role?: string | null
          start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      bb_stock_movements: {
        Row: {
          created_at: string
          created_by: string | null
          from_location_id: string | null
          id: string
          notes: string | null
          occurred_at: string
          owner_id: string
          quantity: number
          r2o_product_id: number
          ref_id: string | null
          ref_table: string | null
          to_location_id: string | null
          type: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          from_location_id?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          owner_id: string
          quantity: number
          r2o_product_id: number
          ref_id?: string | null
          ref_table?: string | null
          to_location_id?: string | null
          type: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          from_location_id?: string | null
          id?: string
          notes?: string | null
          occurred_at?: string
          owner_id?: string
          quantity?: number
          r2o_product_id?: number
          ref_id?: string | null
          ref_table?: string | null
          to_location_id?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_stock_movements_from_location_id_fkey"
            columns: ["from_location_id"]
            isOneToOne: false
            referencedRelation: "bb_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bb_stock_movements_to_location_id_fkey"
            columns: ["to_location_id"]
            isOneToOne: false
            referencedRelation: "bb_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_stock_thresholds: {
        Row: {
          location_id: string
          min_quantity: number
          owner_id: string
          r2o_product_id: number
          updated_at: string
        }
        Insert: {
          location_id: string
          min_quantity?: number
          owner_id: string
          r2o_product_id: number
          updated_at?: string
        }
        Update: {
          location_id?: string
          min_quantity?: number
          owner_id?: string
          r2o_product_id?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bb_stock_thresholds_location_id_fkey"
            columns: ["location_id"]
            isOneToOne: false
            referencedRelation: "bb_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_suppliers: {
        Row: {
          active: boolean
          address: string | null
          contact_name: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          owner_id: string
          phone: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          owner_id: string
          phone?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          address?: string | null
          contact_name?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          owner_id?: string
          phone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      integrations: {
        Row: {
          account_token: string
          accounting_start_date: string | null
          auto_sync_minutes: number | null
          created_at: string
          id: string
          last_full_sync_at: string | null
          last_synced_at: string | null
          metadata: Json
          provider: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_token: string
          accounting_start_date?: string | null
          auto_sync_minutes?: number | null
          created_at?: string
          id?: string
          last_full_sync_at?: string | null
          last_synced_at?: string | null
          metadata?: Json
          provider: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_token?: string
          accounting_start_date?: string | null
          auto_sync_minutes?: number | null
          created_at?: string
          id?: string
          last_full_sync_at?: string | null
          last_synced_at?: string | null
          metadata?: Json
          provider?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      product_costs: {
        Row: {
          amount: number
          created_at: string
          id: string
          label: string
          product_id: string
          sort_order: number
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          label: string
          product_id: string
          sort_order?: number
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          label?: string
          product_id?: string
          sort_order?: number
        }
        Relationships: [
          {
            foreignKeyName: "product_costs_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          category_id: string | null
          cost_price: number
          created_at: string
          depth_cm: number | null
          description: string | null
          height_cm: number | null
          id: string
          image_url: string | null
          margin_percent: number | null
          name: string
          selling_price: number
          sku: string
          stock: number
          supplier_id: string | null
          updated_at: string
          vat_rate: number
          weight_kg: number | null
          width_cm: number | null
        }
        Insert: {
          active?: boolean
          category_id?: string | null
          cost_price?: number
          created_at?: string
          depth_cm?: number | null
          description?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          margin_percent?: number | null
          name: string
          selling_price?: number
          sku: string
          stock?: number
          supplier_id?: string | null
          updated_at?: string
          vat_rate?: number
          weight_kg?: number | null
          width_cm?: number | null
        }
        Update: {
          active?: boolean
          category_id?: string | null
          cost_price?: number
          created_at?: string
          depth_cm?: number | null
          description?: string | null
          height_cm?: number | null
          id?: string
          image_url?: string | null
          margin_percent?: number | null
          name?: string
          selling_price?: number
          sku?: string
          stock?: number
          supplier_id?: string | null
          updated_at?: string
          vat_rate?: number
          weight_kg?: number | null
          width_cm?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          active: boolean
          created_at: string
          default_cash_register_id: string | null
          default_location_id: string | null
          email: string
          full_name: string | null
          id: string
          owner_id: string
          r2o_user_id: number | null
          role: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          default_cash_register_id?: string | null
          default_location_id?: string | null
          email: string
          full_name?: string | null
          id: string
          owner_id: string
          r2o_user_id?: number | null
          role?: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          default_cash_register_id?: string | null
          default_location_id?: string | null
          email?: string
          full_name?: string | null
          id?: string
          owner_id?: string
          r2o_user_id?: number | null
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_default_cash_register_id_fkey"
            columns: ["default_cash_register_id"]
            isOneToOne: false
            referencedRelation: "bb_cash_registers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_cash_register_id_fkey"
            columns: ["default_cash_register_id"]
            isOneToOne: false
            referencedRelation: "bb_cash_registers_status"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_default_cash_register_id_fkey"
            columns: ["default_cash_register_id"]
            isOneToOne: false
            referencedRelation: "bb_unbooked_sales"
            referencedColumns: ["cash_register_id"]
          },
          {
            foreignKeyName: "profiles_default_location_id_fkey"
            columns: ["default_location_id"]
            isOneToOne: false
            referencedRelation: "bb_locations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profiles_owner_fk"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          description: string
          id: string
          product_id: string | null
          quantity: number
          quote_id: string
          sort_order: number
          unit_price: number
          vat_rate: number
        }
        Insert: {
          description: string
          id?: string
          product_id?: string | null
          quantity?: number
          quote_id: string
          sort_order?: number
          unit_price: number
          vat_rate?: number
        }
        Update: {
          description?: string
          id?: string
          product_id?: string | null
          quantity?: number
          quote_id?: string
          sort_order?: number
          unit_price?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_email: string | null
          customer_name: string | null
          id: string
          notes: string | null
          number: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          notes?: string | null
          number?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string | null
          id?: string
          notes?: string | null
          number?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      r2o_bill_types: {
        Row: {
          bill_type_id: number
          bill_type_name: string | null
          bill_type_symbol: string | null
          owner_id: string
          raw: Json
          synced_at: string
        }
        Insert: {
          bill_type_id: number
          bill_type_name?: string | null
          bill_type_symbol?: string | null
          owner_id: string
          raw?: Json
          synced_at?: string
        }
        Update: {
          bill_type_id?: number
          bill_type_name?: string | null
          bill_type_symbol?: string | null
          owner_id?: string
          raw?: Json
          synced_at?: string
        }
        Relationships: []
      }
      r2o_customers: {
        Row: {
          customer_active: boolean | null
          customer_city: string | null
          customer_company_name: string | null
          customer_country: string | null
          customer_created_at: string | null
          customer_email: string | null
          customer_first_name: string | null
          customer_id: number
          customer_last_name: string | null
          customer_name: string | null
          customer_phone: string | null
          customer_street: string | null
          customer_updated_at: string | null
          customer_vat_id: string | null
          customer_zip: string | null
          owner_id: string
          raw: Json
          synced_at: string
        }
        Insert: {
          customer_active?: boolean | null
          customer_city?: string | null
          customer_company_name?: string | null
          customer_country?: string | null
          customer_created_at?: string | null
          customer_email?: string | null
          customer_first_name?: string | null
          customer_id: number
          customer_last_name?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_street?: string | null
          customer_updated_at?: string | null
          customer_vat_id?: string | null
          customer_zip?: string | null
          owner_id: string
          raw?: Json
          synced_at?: string
        }
        Update: {
          customer_active?: boolean | null
          customer_city?: string | null
          customer_company_name?: string | null
          customer_country?: string | null
          customer_created_at?: string | null
          customer_email?: string | null
          customer_first_name?: string | null
          customer_id?: number
          customer_last_name?: string | null
          customer_name?: string | null
          customer_phone?: string | null
          customer_street?: string | null
          customer_updated_at?: string | null
          customer_vat_id?: string | null
          customer_zip?: string | null
          owner_id?: string
          raw?: Json
          synced_at?: string
        }
        Relationships: []
      }
      r2o_discount_groups: {
        Row: {
          discount_group_active: boolean | null
          discount_group_description: string | null
          discount_group_id: number
          discount_group_name: string | null
          owner_id: string
          raw: Json
          synced_at: string
        }
        Insert: {
          discount_group_active?: boolean | null
          discount_group_description?: string | null
          discount_group_id: number
          discount_group_name?: string | null
          owner_id: string
          raw?: Json
          synced_at?: string
        }
        Update: {
          discount_group_active?: boolean | null
          discount_group_description?: string | null
          discount_group_id?: number
          discount_group_name?: string | null
          owner_id?: string
          raw?: Json
          synced_at?: string
        }
        Relationships: []
      }
      r2o_discounts: {
        Row: {
          discount_active: boolean | null
          discount_created_at: string | null
          discount_description: string | null
          discount_group_id: number | null
          discount_id: number
          discount_name: string | null
          discount_order: number | null
          discount_unit: string | null
          discount_updated_at: string | null
          discount_value: number | null
          owner_id: string
          raw: Json
          synced_at: string
        }
        Insert: {
          discount_active?: boolean | null
          discount_created_at?: string | null
          discount_description?: string | null
          discount_group_id?: number | null
          discount_id: number
          discount_name?: string | null
          discount_order?: number | null
          discount_unit?: string | null
          discount_updated_at?: string | null
          discount_value?: number | null
          owner_id: string
          raw?: Json
          synced_at?: string
        }
        Update: {
          discount_active?: boolean | null
          discount_created_at?: string | null
          discount_description?: string | null
          discount_group_id?: number | null
          discount_id?: number
          discount_name?: string | null
          discount_order?: number | null
          discount_unit?: string | null
          discount_updated_at?: string | null
          discount_value?: number | null
          owner_id?: string
          raw?: Json
          synced_at?: string
        }
        Relationships: []
      }
      r2o_invoice_items: {
        Row: {
          daily_report_id: number | null
          invoice_id: number
          item_accounting_code: string | null
          item_comment: string | null
          item_discountable: boolean | null
          item_id: number
          item_invoice_discount_gross: number | null
          item_invoice_discount_net: number | null
          item_line_discount_gross: number | null
          item_line_discount_id: number | null
          item_line_discount_name: string | null
          item_line_discount_net: number | null
          item_line_discount_percent: number | null
          item_name: string | null
          item_price: number | null
          item_price_base: boolean | null
          item_price_net: number | null
          item_product_name: string | null
          item_product_price: number | null
          item_product_price_net: number | null
          item_product_price_net_per_unit: number | null
          item_product_price_per_unit: number | null
          item_product_vat: number | null
          item_product_vat_rate: number | null
          item_qty: number | null
          item_quantity: number | null
          item_retour: boolean | null
          item_test_mode: boolean | null
          item_timestamp: string | null
          item_total: number | null
          item_total_net: number | null
          item_vat: number | null
          item_vat_rate: number | null
          owner_id: string
          payment_method_id: number | null
          product_id: number | null
          productgroup_id: number | null
          productgroup_name: string | null
          raw: Json
          synced_at: string
          table_id: number | null
          table_name: string | null
          user_id: number | null
          user_name: string | null
        }
        Insert: {
          daily_report_id?: number | null
          invoice_id: number
          item_accounting_code?: string | null
          item_comment?: string | null
          item_discountable?: boolean | null
          item_id: number
          item_invoice_discount_gross?: number | null
          item_invoice_discount_net?: number | null
          item_line_discount_gross?: number | null
          item_line_discount_id?: number | null
          item_line_discount_name?: string | null
          item_line_discount_net?: number | null
          item_line_discount_percent?: number | null
          item_name?: string | null
          item_price?: number | null
          item_price_base?: boolean | null
          item_price_net?: number | null
          item_product_name?: string | null
          item_product_price?: number | null
          item_product_price_net?: number | null
          item_product_price_net_per_unit?: number | null
          item_product_price_per_unit?: number | null
          item_product_vat?: number | null
          item_product_vat_rate?: number | null
          item_qty?: number | null
          item_quantity?: number | null
          item_retour?: boolean | null
          item_test_mode?: boolean | null
          item_timestamp?: string | null
          item_total?: number | null
          item_total_net?: number | null
          item_vat?: number | null
          item_vat_rate?: number | null
          owner_id: string
          payment_method_id?: number | null
          product_id?: number | null
          productgroup_id?: number | null
          productgroup_name?: string | null
          raw?: Json
          synced_at?: string
          table_id?: number | null
          table_name?: string | null
          user_id?: number | null
          user_name?: string | null
        }
        Update: {
          daily_report_id?: number | null
          invoice_id?: number
          item_accounting_code?: string | null
          item_comment?: string | null
          item_discountable?: boolean | null
          item_id?: number
          item_invoice_discount_gross?: number | null
          item_invoice_discount_net?: number | null
          item_line_discount_gross?: number | null
          item_line_discount_id?: number | null
          item_line_discount_name?: string | null
          item_line_discount_net?: number | null
          item_line_discount_percent?: number | null
          item_name?: string | null
          item_price?: number | null
          item_price_base?: boolean | null
          item_price_net?: number | null
          item_product_name?: string | null
          item_product_price?: number | null
          item_product_price_net?: number | null
          item_product_price_net_per_unit?: number | null
          item_product_price_per_unit?: number | null
          item_product_vat?: number | null
          item_product_vat_rate?: number | null
          item_qty?: number | null
          item_quantity?: number | null
          item_retour?: boolean | null
          item_test_mode?: boolean | null
          item_timestamp?: string | null
          item_total?: number | null
          item_total_net?: number | null
          item_vat?: number | null
          item_vat_rate?: number | null
          owner_id?: string
          payment_method_id?: number | null
          product_id?: number | null
          productgroup_id?: number | null
          productgroup_name?: string | null
          raw?: Json
          synced_at?: string
          table_id?: number | null
          table_name?: string | null
          user_id?: number | null
          user_name?: string | null
        }
        Relationships: []
      }
      r2o_invoices: {
        Row: {
          bill_type_id: number | null
          currency_id: number | null
          customer_id: number | null
          daily_report_end_date: string | null
          daily_report_id: number | null
          daily_report_number: number | null
          daily_report_start_date: string | null
          invoice_deleted_at: string | null
          invoice_deleted_reason: string | null
          invoice_due_date: string | null
          invoice_external_reference_number: string | null
          invoice_id: number
          invoice_locked: boolean | null
          invoice_number: number | null
          invoice_number_full: string | null
          invoice_paid: boolean | null
          invoice_paid_date: string | null
          invoice_price_base: string | null
          invoice_test_mode: boolean | null
          invoice_timestamp: string | null
          invoice_total: number | null
          invoice_total_net: number | null
          invoice_total_tip: number | null
          invoice_total_vat: number | null
          items_count: number | null
          items_synced_at: string | null
          owner_id: string
          payment_method_id: number | null
          raw: Json
          synced_at: string
          table_area_id: number | null
          table_id: number | null
          user_id: number | null
        }
        Insert: {
          bill_type_id?: number | null
          currency_id?: number | null
          customer_id?: number | null
          daily_report_end_date?: string | null
          daily_report_id?: number | null
          daily_report_number?: number | null
          daily_report_start_date?: string | null
          invoice_deleted_at?: string | null
          invoice_deleted_reason?: string | null
          invoice_due_date?: string | null
          invoice_external_reference_number?: string | null
          invoice_id: number
          invoice_locked?: boolean | null
          invoice_number?: number | null
          invoice_number_full?: string | null
          invoice_paid?: boolean | null
          invoice_paid_date?: string | null
          invoice_price_base?: string | null
          invoice_test_mode?: boolean | null
          invoice_timestamp?: string | null
          invoice_total?: number | null
          invoice_total_net?: number | null
          invoice_total_tip?: number | null
          invoice_total_vat?: number | null
          items_count?: number | null
          items_synced_at?: string | null
          owner_id: string
          payment_method_id?: number | null
          raw?: Json
          synced_at?: string
          table_area_id?: number | null
          table_id?: number | null
          user_id?: number | null
        }
        Update: {
          bill_type_id?: number | null
          currency_id?: number | null
          customer_id?: number | null
          daily_report_end_date?: string | null
          daily_report_id?: number | null
          daily_report_number?: number | null
          daily_report_start_date?: string | null
          invoice_deleted_at?: string | null
          invoice_deleted_reason?: string | null
          invoice_due_date?: string | null
          invoice_external_reference_number?: string | null
          invoice_id?: number
          invoice_locked?: boolean | null
          invoice_number?: number | null
          invoice_number_full?: string | null
          invoice_paid?: boolean | null
          invoice_paid_date?: string | null
          invoice_price_base?: string | null
          invoice_test_mode?: boolean | null
          invoice_timestamp?: string | null
          invoice_total?: number | null
          invoice_total_net?: number | null
          invoice_total_tip?: number | null
          invoice_total_vat?: number | null
          items_count?: number | null
          items_synced_at?: string | null
          owner_id?: string
          payment_method_id?: number | null
          raw?: Json
          synced_at?: string
          table_area_id?: number | null
          table_id?: number | null
          user_id?: number | null
        }
        Relationships: []
      }
      r2o_payment_methods: {
        Row: {
          owner_id: string
          payment_accounting_code: string | null
          payment_description: string | null
          payment_id: number
          payment_mark_as_paid: boolean | null
          payment_name: string | null
          payment_purpose: string | null
          payment_type_id: number | null
          raw: Json
          synced_at: string
        }
        Insert: {
          owner_id: string
          payment_accounting_code?: string | null
          payment_description?: string | null
          payment_id: number
          payment_mark_as_paid?: boolean | null
          payment_name?: string | null
          payment_purpose?: string | null
          payment_type_id?: number | null
          raw?: Json
          synced_at?: string
        }
        Update: {
          owner_id?: string
          payment_accounting_code?: string | null
          payment_description?: string | null
          payment_id?: number
          payment_mark_as_paid?: boolean | null
          payment_name?: string | null
          payment_purpose?: string | null
          payment_type_id?: number | null
          raw?: Json
          synced_at?: string
        }
        Relationships: []
      }
      r2o_productgroups: {
        Row: {
          owner_id: string
          productgroup_accounting_code: string | null
          productgroup_active: boolean | null
          productgroup_created_at: string | null
          productgroup_description: string | null
          productgroup_id: number
          productgroup_name: string | null
          productgroup_parent: number | null
          productgroup_shortcut: string | null
          productgroup_sort_index: number | null
          productgroup_type_id: number | null
          productgroup_updated_at: string | null
          raw: Json
          synced_at: string
        }
        Insert: {
          owner_id: string
          productgroup_accounting_code?: string | null
          productgroup_active?: boolean | null
          productgroup_created_at?: string | null
          productgroup_description?: string | null
          productgroup_id: number
          productgroup_name?: string | null
          productgroup_parent?: number | null
          productgroup_shortcut?: string | null
          productgroup_sort_index?: number | null
          productgroup_type_id?: number | null
          productgroup_updated_at?: string | null
          raw?: Json
          synced_at?: string
        }
        Update: {
          owner_id?: string
          productgroup_accounting_code?: string | null
          productgroup_active?: boolean | null
          productgroup_created_at?: string | null
          productgroup_description?: string | null
          productgroup_id?: number
          productgroup_name?: string | null
          productgroup_parent?: number | null
          productgroup_shortcut?: string | null
          productgroup_sort_index?: number | null
          productgroup_type_id?: number | null
          productgroup_updated_at?: string | null
          raw?: Json
          synced_at?: string
        }
        Relationships: []
      }
      r2o_products: {
        Row: {
          images: Json | null
          owner_id: string
          product_accounting_code: string | null
          product_active: boolean | null
          product_alternative_name_in_pos: string | null
          product_alternative_name_on_receipts: string | null
          product_barcode: string | null
          product_color_class: string | null
          product_created_at: string | null
          product_custom_price: boolean | null
          product_custom_quantity: boolean | null
          product_description: string | null
          product_discountable: boolean | null
          product_express_mode: boolean | null
          product_external_reference: string | null
          product_fav: boolean | null
          product_highlight: boolean | null
          product_id: number
          product_ingredients_enabled: boolean | null
          product_itemnumber: string | null
          product_name: string | null
          product_price: number | null
          product_price_includes_vat: boolean | null
          product_side_dish_order: boolean | null
          product_sold_out: boolean | null
          product_sort_index: number | null
          product_stock_enabled: boolean | null
          product_stock_reorder_level: number | null
          product_stock_safety_stock: number | null
          product_stock_unit: string | null
          product_stock_value: number | null
          product_type: Json | null
          product_type_id: number | null
          product_updated_at: string | null
          product_variations_enabled: boolean | null
          product_vat: number | null
          product_vat_id: number | null
          productgroup_id: number | null
          raw: Json
          synced_at: string
        }
        Insert: {
          images?: Json | null
          owner_id: string
          product_accounting_code?: string | null
          product_active?: boolean | null
          product_alternative_name_in_pos?: string | null
          product_alternative_name_on_receipts?: string | null
          product_barcode?: string | null
          product_color_class?: string | null
          product_created_at?: string | null
          product_custom_price?: boolean | null
          product_custom_quantity?: boolean | null
          product_description?: string | null
          product_discountable?: boolean | null
          product_express_mode?: boolean | null
          product_external_reference?: string | null
          product_fav?: boolean | null
          product_highlight?: boolean | null
          product_id: number
          product_ingredients_enabled?: boolean | null
          product_itemnumber?: string | null
          product_name?: string | null
          product_price?: number | null
          product_price_includes_vat?: boolean | null
          product_side_dish_order?: boolean | null
          product_sold_out?: boolean | null
          product_sort_index?: number | null
          product_stock_enabled?: boolean | null
          product_stock_reorder_level?: number | null
          product_stock_safety_stock?: number | null
          product_stock_unit?: string | null
          product_stock_value?: number | null
          product_type?: Json | null
          product_type_id?: number | null
          product_updated_at?: string | null
          product_variations_enabled?: boolean | null
          product_vat?: number | null
          product_vat_id?: number | null
          productgroup_id?: number | null
          raw?: Json
          synced_at?: string
        }
        Update: {
          images?: Json | null
          owner_id?: string
          product_accounting_code?: string | null
          product_active?: boolean | null
          product_alternative_name_in_pos?: string | null
          product_alternative_name_on_receipts?: string | null
          product_barcode?: string | null
          product_color_class?: string | null
          product_created_at?: string | null
          product_custom_price?: boolean | null
          product_custom_quantity?: boolean | null
          product_description?: string | null
          product_discountable?: boolean | null
          product_express_mode?: boolean | null
          product_external_reference?: string | null
          product_fav?: boolean | null
          product_highlight?: boolean | null
          product_id?: number
          product_ingredients_enabled?: boolean | null
          product_itemnumber?: string | null
          product_name?: string | null
          product_price?: number | null
          product_price_includes_vat?: boolean | null
          product_side_dish_order?: boolean | null
          product_sold_out?: boolean | null
          product_sort_index?: number | null
          product_stock_enabled?: boolean | null
          product_stock_reorder_level?: number | null
          product_stock_safety_stock?: number | null
          product_stock_unit?: string | null
          product_stock_value?: number | null
          product_type?: Json | null
          product_type_id?: number | null
          product_updated_at?: string | null
          product_variations_enabled?: boolean | null
          product_vat?: number | null
          product_vat_id?: number | null
          productgroup_id?: number | null
          raw?: Json
          synced_at?: string
        }
        Relationships: []
      }
      r2o_sync_logs: {
        Row: {
          detail: Json | null
          duration_ms: number | null
          error: string | null
          id: number
          message: string | null
          mode: string
          ok: boolean
          owner_id: string
          ran_at: string
          records: number | null
          trigger: string
        }
        Insert: {
          detail?: Json | null
          duration_ms?: number | null
          error?: string | null
          id?: never
          message?: string | null
          mode: string
          ok?: boolean
          owner_id: string
          ran_at?: string
          records?: number | null
          trigger: string
        }
        Update: {
          detail?: Json | null
          duration_ms?: number | null
          error?: string | null
          id?: never
          message?: string | null
          mode?: string
          ok?: boolean
          owner_id?: string
          ran_at?: string
          records?: number | null
          trigger?: string
        }
        Relationships: []
      }
      r2o_table_areas: {
        Row: {
          owner_id: string
          raw: Json
          synced_at: string
          table_area_active: boolean | null
          table_area_allow_temporary_tables: boolean | null
          table_area_id: number
          table_area_name: string | null
          table_area_order: number | null
          table_area_short_name: string | null
        }
        Insert: {
          owner_id: string
          raw?: Json
          synced_at?: string
          table_area_active?: boolean | null
          table_area_allow_temporary_tables?: boolean | null
          table_area_id: number
          table_area_name?: string | null
          table_area_order?: number | null
          table_area_short_name?: string | null
        }
        Update: {
          owner_id?: string
          raw?: Json
          synced_at?: string
          table_area_active?: boolean | null
          table_area_allow_temporary_tables?: boolean | null
          table_area_id?: number
          table_area_name?: string | null
          table_area_order?: number | null
          table_area_short_name?: string | null
        }
        Relationships: []
      }
      r2o_tables: {
        Row: {
          owner_id: string
          raw: Json
          synced_at: string
          table_area_id: number | null
          table_checkout_mode: boolean | null
          table_created_at: string | null
          table_description: string | null
          table_id: number
          table_is_temporary: boolean | null
          table_name: string | null
          table_order: number | null
          table_updated_at: string | null
        }
        Insert: {
          owner_id: string
          raw?: Json
          synced_at?: string
          table_area_id?: number | null
          table_checkout_mode?: boolean | null
          table_created_at?: string | null
          table_description?: string | null
          table_id: number
          table_is_temporary?: boolean | null
          table_name?: string | null
          table_order?: number | null
          table_updated_at?: string | null
        }
        Update: {
          owner_id?: string
          raw?: Json
          synced_at?: string
          table_area_id?: number | null
          table_checkout_mode?: boolean | null
          table_created_at?: string | null
          table_description?: string | null
          table_id?: number
          table_is_temporary?: boolean | null
          table_name?: string | null
          table_order?: number | null
          table_updated_at?: string | null
        }
        Relationships: []
      }
      r2o_users: {
        Row: {
          owner_id: string
          r2o_user_id: number
          raw: Json
          right_id: number | null
          synced_at: string
          user_created_at: string | null
          user_first_name: string | null
          user_last_action_at: string | null
          user_last_login_at: string | null
          user_last_name: string | null
          user_print_access: number | null
          user_printer: number | null
          user_trainings_mode: boolean | null
          user_updated_at: string | null
          user_username: string | null
        }
        Insert: {
          owner_id: string
          r2o_user_id: number
          raw?: Json
          right_id?: number | null
          synced_at?: string
          user_created_at?: string | null
          user_first_name?: string | null
          user_last_action_at?: string | null
          user_last_login_at?: string | null
          user_last_name?: string | null
          user_print_access?: number | null
          user_printer?: number | null
          user_trainings_mode?: boolean | null
          user_updated_at?: string | null
          user_username?: string | null
        }
        Update: {
          owner_id?: string
          r2o_user_id?: number
          raw?: Json
          right_id?: number | null
          synced_at?: string
          user_created_at?: string | null
          user_first_name?: string | null
          user_last_action_at?: string | null
          user_last_login_at?: string | null
          user_last_name?: string | null
          user_print_access?: number | null
          user_printer?: number | null
          user_trainings_mode?: boolean | null
          user_updated_at?: string | null
          user_username?: string | null
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          contact: string | null
          created_at: string
          id: string
          name: string
          notes: string | null
        }
        Insert: {
          contact?: string | null
          created_at?: string
          id?: string
          name: string
          notes?: string | null
        }
        Update: {
          contact?: string | null
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      bb_cash_registers_status: {
        Row: {
          active: boolean | null
          current_assignment_id: string | null
          current_assignment_since: string | null
          current_location_id: string | null
          current_location_name: string | null
          current_location_type: string | null
          id: string | null
          is_unassigned: boolean | null
          name: string | null
          owner_id: string | null
          r2o_cash_register_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bb_register_assignments_location_id_fkey"
            columns: ["current_location_id"]
            isOneToOne: false
            referencedRelation: "bb_locations"
            referencedColumns: ["id"]
          },
        ]
      }
      bb_stock_by_location: {
        Row: {
          location_id: string | null
          owner_id: string | null
          quantity: number | null
          r2o_product_id: number | null
        }
        Relationships: []
      }
      bb_unbooked_sales: {
        Row: {
          cash_register_id: string | null
          cash_register_name: string | null
          invoice_id: number | null
          invoice_number_full: string | null
          invoice_timestamp: string | null
          owner_id: string | null
          r2o_cash_register_id: string | null
          reason: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      bb_assign_register: {
        Args: {
          p_cash_register_id: string
          p_location_id: string
          p_notes?: string
          p_valid_from?: string
        }
        Returns: string
      }
      bb_book_purchase: { Args: { p_purchase_id: string }; Returns: undefined }
      bb_current_owner_id: { Args: never; Returns: string }
      bb_current_role: { Args: never; Returns: string }
      bb_end_shift: {
        Args: { p_end_cash?: number; p_notes?: string; p_shift_id: string }
        Returns: undefined
      }
      bb_resolve_bike_location: {
        Args: { p_invoice_id: number; p_owner: string }
        Returns: string
      }
      bb_start_shift: {
        Args: {
          p_cash_register_id?: string
          p_location_id: string
          p_notes?: string
          p_r2o_user_id?: number
          p_start_cash?: number
        }
        Returns: string
      }
      is_admin: { Args: never; Returns: boolean }
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


// ─── Hand-rolled domain types (preserved) ───

export type Role = "admin" | "user";

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  role: Role;
  default_location_id: string | null;
  created_at: string;
};

export type Category = {
  id: string;
  name: string;
  created_at: string;
};


export type Product = {
  id: string;
  sku: string;
  name: string;
  description: string | null;
  cost_price: number;
  selling_price: number;
  vat_rate: number;
  margin_percent: number | null;
  category_id: string | null;
  supplier_id: string | null;
  image_url: string | null;
  stock: number;
  weight_kg: number | null;
  width_cm: number | null;
  height_cm: number | null;
  depth_cm: number | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductCost = {
  id: string;
  product_id: string;
  label: string;
  amount: number;
  sort_order: number;
  created_at: string;
};

export type QuoteStatus = "draft" | "sent" | "accepted" | "rejected";

export type Quote = {
  id: string;
  number: string | null;
  title: string;
  customer_name: string | null;
  customer_email: string | null;
  customer_address: string | null;
  status: QuoteStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type Supplier = {
  id: string;
  owner_id: string;
  name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProductExtra = {
  owner_id: string;
  r2o_product_id: number;
  cost_price: number | null;
  cost_includes_vat: boolean;
  supplier_id: string | null;
  reorder_level: number | null;
  target_margin_pct: number | null;
  package_unit: string | null;
  package_qty: number | null;
  custom_name: string | null;
  custom_category: string | null;
  notes: string | null;
  last_purchase_date: string | null;
  last_purchase_price: number | null;
  deposit_product_id: number | null;
  shelf_life_days: number | null;
  stock_behavior: "sale" | "retour_for" | "no_stock_effect";
  retour_for_product_id: number | null;
  created_at: string;
  updated_at: string;
};

export type FixedCostFrequency = "daily" | "weekly" | "monthly" | "yearly";

export type FixedCost = {
  id: string;
  owner_id: string;
  name: string;
  description: string | null;
  category: string | null;
  amount: number;
  frequency: FixedCostFrequency;
  start_date: string;
  end_date: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type StaffCost = {
  id: string;
  owner_id: string;
  r2o_user_id: number | null;
  display_name: string;
  role: string | null;
  monthly_salary: number | null;
  hourly_rate: number | null;
  hours_per_week: number | null;
  commission_pct: number | null;
  employer_cost_factor: number | null;
  start_date: string;
  end_date: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type IntegrationProvider = "ready2order";

export type Integration = {
  id: string;
  user_id: string;
  provider: IntegrationProvider;
  account_token: string;
  metadata: Record<string, unknown>;
  auto_sync_minutes: number | null;
  last_synced_at: string | null;
  last_full_sync_at: string | null;
  accounting_start_date: string | null;
  created_at: string;
  updated_at: string;
};

export type LocationType = "warehouse" | "bike";

export type Location = {
  id: string;
  owner_id: string;
  name: string;
  type: LocationType;
  active: boolean;
  notes: string | null;
  restock_source_location_id: string | null;
  created_at: string;
  updated_at: string;
};

export type CashRegister = {
  id: string;
  owner_id: string;
  name: string;
  r2o_cash_register_id: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type CashRegisterStatus = {
  id: string;
  owner_id: string;
  name: string;
  r2o_cash_register_id: string | null;
  active: boolean;
  current_assignment_id: string | null;
  current_location_id: string | null;
  current_assignment_since: string | null;
  current_location_name: string | null;
  current_location_type: LocationType | null;
  is_unassigned: boolean;
};

export type RegisterAssignment = {
  id: string;
  owner_id: string;
  cash_register_id: string;
  location_id: string;
  valid_from: string;
  valid_to: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type PurchaseStatus = "draft" | "booked";

export type Purchase = {
  id: string;
  owner_id: string;
  supplier_id: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  destination_location_id: string;
  total_net: number | null;
  total_gross: number | null;
  notes: string | null;
  status: PurchaseStatus;
  received_at: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type PurchaseItem = {
  id: string;
  owner_id: string;
  purchase_id: string;
  r2o_product_id: number;
  quantity: number;
  unit_cost_net: number | null;
  expiry_date: string | null;
  notes: string | null;
  sort_order: number;
  created_at: string;
};

export type StockMovementType =
  | "purchase"
  | "transfer"
  | "sale"
  | "adjustment"
  | "reversal";

export type StockMovement = {
  id: string;
  owner_id: string;
  r2o_product_id: number;
  from_location_id: string | null;
  to_location_id: string | null;
  quantity: number;
  type: StockMovementType;
  ref_table: string | null;
  ref_id: string | null;
  occurred_at: string;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type StockByLocation = {
  owner_id: string;
  r2o_product_id: number;
  location_id: string;
  quantity: number;
};

export type StockThreshold = {
  owner_id: string;
  r2o_product_id: number;
  location_id: string;
  min_quantity: number;
  updated_at: string;
};

export type ShiftStatus = "open" | "closed";

export type Shift = {
  id: string;
  owner_id: string;
  location_id: string;
  r2o_user_id: number | null;
  cash_register_id: string | null;
  started_at: string;
  ended_at: string | null;
  start_cash_eur: number | null;
  end_cash_eur: number | null;
  start_notes: string | null;
  end_notes: string | null;
  status: ShiftStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type ShiftCountType = "start" | "end" | "mid";

export type ShiftCount = {
  id: string;
  owner_id: string;
  shift_id: string;
  r2o_product_id: number;
  count_type: ShiftCountType;
  counted_qty: number;
  expected_qty: number | null;
  cleared_at: string | null;
  counted_at: string;
  counted_by: string | null;
  notes: string | null;
};

export type UnbookedSaleReason =
  | "no_register_id_in_raw"
  | "cash_register_unknown"
  | "no_assignment_at_timestamp";

export type UnbookedSale = {
  owner_id: string;
  invoice_id: number;
  invoice_number_full: string | null;
  invoice_timestamp: string | null;
  r2o_cash_register_id: string | null;
  cash_register_id: string | null;
  cash_register_name: string | null;
  reason: UnbookedSaleReason;
};

export type QuoteItem = {
  id: string;
  quote_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  vat_rate: number;
  sort_order: number;
};
