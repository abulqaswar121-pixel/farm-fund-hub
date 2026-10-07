export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      cycle_investments: {
        Row: {
          id: string;
          cycle_id: string;
          member_id: string;
          amount: number;
          date: string;
          method: Database["public"]["Enums"]["investment_method"];
          status: Database["public"]["Enums"]["investment_status"];
          paystack_reference: string | null;
          bank_reference: string | null;
          receipt_number: string | null;
          verified_at: string | null;
          verified_by: string | null;
          rollover_source_cycle_id: string | null;
          transferred_out: number;
          transfer_id: string | null;
          note: string | null;
          recorded_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cycle_id: string;
          member_id: string;
          amount: number;
          date?: string;
          method: Database["public"]["Enums"]["investment_method"];
          status?: Database["public"]["Enums"]["investment_status"];
          paystack_reference?: string | null;
          bank_reference?: string | null;
          receipt_number?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          rollover_source_cycle_id?: string | null;
          transferred_out?: number;
          transfer_id?: string | null;
          note?: string | null;
          recorded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cycle_id?: string;
          member_id?: string;
          amount?: number;
          date?: string;
          method?: Database["public"]["Enums"]["investment_method"];
          status?: Database["public"]["Enums"]["investment_status"];
          paystack_reference?: string | null;
          bank_reference?: string | null;
          receipt_number?: string | null;
          verified_at?: string | null;
          verified_by?: string | null;
          rollover_source_cycle_id?: string | null;
          transferred_out?: number;
          transfer_id?: string | null;
          note?: string | null;
          recorded_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      farm_cycles: {
        Row: {
          id: string;
          code: string;
          commodity: Database["public"]["Enums"]["commodity_type"];
          name: string;
          summary: string | null;
          farm_site: string;
          farm_latitude: number | null;
          farm_longitude: number | null;
          target_capital: number;
          minimum_ticket: number;
          projected_revenue: number;
          projected_liabilities: number;
          profit_investor_percent: number;
          profit_operator_percent: number;
          reserve_percent: number;
          cycle_weeks: number;
          funding_opens_on: string;
          funding_closes_on: string | null;
          stocking_on: string | null;
          projected_harvest_on: string | null;
          status: Database["public"]["Enums"]["cycle_status"];
          current_stage: Database["public"]["Enums"]["stage_id"];
          locked_at: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          commodity: Database["public"]["Enums"]["commodity_type"];
          name: string;
          summary?: string | null;
          farm_site?: string;
          farm_latitude?: number | null;
          farm_longitude?: number | null;
          target_capital: number;
          minimum_ticket?: number;
          projected_revenue?: number;
          projected_liabilities?: number;
          profit_investor_percent?: number;
          profit_operator_percent?: number;
          reserve_percent?: number;
          cycle_weeks?: number;
          funding_opens_on?: string;
          funding_closes_on?: string | null;
          stocking_on?: string | null;
          projected_harvest_on?: string | null;
          status?: Database["public"]["Enums"]["cycle_status"];
          current_stage?: Database["public"]["Enums"]["stage_id"];
          locked_at?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          commodity?: Database["public"]["Enums"]["commodity_type"];
          name?: string;
          summary?: string | null;
          farm_site?: string;
          farm_latitude?: number | null;
          farm_longitude?: number | null;
          target_capital?: number;
          minimum_ticket?: number;
          projected_revenue?: number;
          projected_liabilities?: number;
          profit_investor_percent?: number;
          profit_operator_percent?: number;
          reserve_percent?: number;
          cycle_weeks?: number;
          funding_opens_on?: string;
          funding_closes_on?: string | null;
          stocking_on?: string | null;
          projected_harvest_on?: string | null;
          status?: Database["public"]["Enums"]["cycle_status"];
          current_stage?: Database["public"]["Enums"]["stage_id"];
          locked_at?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      farm_expenses: {
        Row: {
          id: string;
          cycle_id: string;
          amount: number;
          date: string;
          category: string;
          vendor: string | null;
          note: string | null;
          is_payable: boolean;
          settled_on: string | null;
          receipt_url: string | null;
          recorded_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cycle_id: string;
          amount: number;
          date?: string;
          category: string;
          vendor?: string | null;
          note?: string | null;
          is_payable?: boolean;
          settled_on?: string | null;
          receipt_url?: string | null;
          recorded_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cycle_id?: string;
          amount?: number;
          date?: string;
          category?: string;
          vendor?: string | null;
          note?: string | null;
          is_payable?: boolean;
          settled_on?: string | null;
          receipt_url?: string | null;
          recorded_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      farm_visits: {
        Row: {
          id: string;
          cycle_id: string | null;
          member_id: string;
          visit_date: string;
          slot: string;
          guests: number;
          status: Database["public"]["Enums"]["visit_status"];
          member_note: string | null;
          decision_note: string | null;
          decided_by: string | null;
          decided_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cycle_id?: string | null;
          member_id: string;
          visit_date: string;
          slot?: string;
          guests?: number;
          status?: Database["public"]["Enums"]["visit_status"];
          member_note?: string | null;
          decision_note?: string | null;
          decided_by?: string | null;
          decided_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cycle_id?: string | null;
          member_id?: string;
          visit_date?: string;
          slot?: string;
          guests?: number;
          status?: Database["public"]["Enums"]["visit_status"];
          member_note?: string | null;
          decision_note?: string | null;
          decided_by?: string | null;
          decided_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      harvest_records: {
        Row: {
          id: string;
          cycle_id: string;
          harvest_date: string;
          total_weight_kg: number | null;
          total_count: number | null;
          scale_ticket_ref: string | null;
          buyer: string | null;
          buyer_note: string | null;
          gross_revenue: number;
          revenue_received_on: string | null;
          receipt_url: string | null;
          recorded_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cycle_id: string;
          harvest_date?: string;
          total_weight_kg?: number | null;
          total_count?: number | null;
          scale_ticket_ref?: string | null;
          buyer?: string | null;
          buyer_note?: string | null;
          gross_revenue?: number;
          revenue_received_on?: string | null;
          receipt_url?: string | null;
          recorded_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cycle_id?: string;
          harvest_date?: string;
          total_weight_kg?: number | null;
          total_count?: number | null;
          scale_ticket_ref?: string | null;
          buyer?: string | null;
          buyer_note?: string | null;
          gross_revenue?: number;
          revenue_received_on?: string | null;
          receipt_url?: string | null;
          recorded_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      incidents: {
        Row: {
          id: string;
          cycle_id: string | null;
          title: string;
          category: string;
          severity: Database["public"]["Enums"]["incident_severity"];
          status: Database["public"]["Enums"]["incident_status"];
          occurred_on: string;
          description: string;
          estimated_impact: number | null;
          insurance_claim_ref: string | null;
          photo_url: string | null;
          resolution_note: string | null;
          resolved_on: string | null;
          logged_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cycle_id?: string | null;
          title: string;
          category: string;
          severity?: Database["public"]["Enums"]["incident_severity"];
          status?: Database["public"]["Enums"]["incident_status"];
          occurred_on?: string;
          description: string;
          estimated_impact?: number | null;
          insurance_claim_ref?: string | null;
          photo_url?: string | null;
          resolution_note?: string | null;
          resolved_on?: string | null;
          logged_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cycle_id?: string | null;
          title?: string;
          category?: string;
          severity?: Database["public"]["Enums"]["incident_severity"];
          status?: Database["public"]["Enums"]["incident_status"];
          occurred_on?: string;
          description?: string;
          estimated_impact?: number | null;
          insurance_claim_ref?: string | null;
          photo_url?: string | null;
          resolution_note?: string | null;
          resolved_on?: string | null;
          logged_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      operational_logs: {
        Row: {
          id: string;
          cycle_id: string;
          log_type: Database["public"]["Enums"]["log_type"];
          log_date: string;
          feed_kg: number | null;
          feed_bags: number | null;
          mortality_count: number | null;
          mortality_reason: string | null;
          population_count: number | null;
          sample_count: number | null;
          sample_avg_weight_g: number | null;
          biomass_kg: number | null;
          crates_collected: number | null;
          bags_harvested: number | null;
          area_sqm: number | null;
          medication: string | null;
          notes: string | null;
          public_summary: string | null;
          photo_url: string | null;
          recorded_by: string;
          review_status: Database["public"]["Enums"]["review_status"];
          reviewed_by: string | null;
          reviewed_at: string | null;
          review_note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cycle_id: string;
          log_type: Database["public"]["Enums"]["log_type"];
          log_date?: string;
          feed_kg?: number | null;
          feed_bags?: number | null;
          mortality_count?: number | null;
          mortality_reason?: string | null;
          population_count?: number | null;
          sample_count?: number | null;
          sample_avg_weight_g?: number | null;
          biomass_kg?: number | null;
          crates_collected?: number | null;
          bags_harvested?: number | null;
          area_sqm?: number | null;
          medication?: string | null;
          notes?: string | null;
          public_summary?: string | null;
          photo_url?: string | null;
          recorded_by: string;
          review_status?: Database["public"]["Enums"]["review_status"];
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cycle_id?: string;
          log_type?: Database["public"]["Enums"]["log_type"];
          log_date?: string;
          feed_kg?: number | null;
          feed_bags?: number | null;
          mortality_count?: number | null;
          mortality_reason?: string | null;
          population_count?: number | null;
          sample_count?: number | null;
          sample_avg_weight_g?: number | null;
          biomass_kg?: number | null;
          crates_collected?: number | null;
          bags_harvested?: number | null;
          area_sqm?: number | null;
          medication?: string | null;
          notes?: string | null;
          public_summary?: string | null;
          photo_url?: string | null;
          recorded_by?: string;
          review_status?: Database["public"]["Enums"]["review_status"];
          reviewed_by?: string | null;
          reviewed_at?: string | null;
          review_note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      rollover_instructions: {
        Row: {
          id: string;
          member_id: string;
          mode: Database["public"]["Enums"]["rollover_mode"];
          preferred_cycle_id: string | null;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          mode?: Database["public"]["Enums"]["rollover_mode"];
          preferred_cycle_id?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          mode?: Database["public"]["Enums"]["rollover_mode"];
          preferred_cycle_id?: string | null;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      share_transfers: {
        Row: {
          id: string;
          cycle_id: string;
          seller_id: string;
          buyer_id: string | null;
          capital_amount: number;
          asking_price: number;
          status: Database["public"]["Enums"]["transfer_status"];
          reason: string | null;
          admin_note: string | null;
          settled_at: string | null;
          settled_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cycle_id: string;
          seller_id: string;
          buyer_id?: string | null;
          capital_amount: number;
          asking_price: number;
          status?: Database["public"]["Enums"]["transfer_status"];
          reason?: string | null;
          admin_note?: string | null;
          settled_at?: string | null;
          settled_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cycle_id?: string;
          seller_id?: string;
          buyer_id?: string | null;
          capital_amount?: number;
          asking_price?: number;
          status?: Database["public"]["Enums"]["transfer_status"];
          reason?: string | null;
          admin_note?: string | null;
          settled_at?: string | null;
          settled_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          id: string;
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          role: Database["public"]["Enums"]["app_role"];
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          created_at?: string;
        };
        Relationships: [];
      };
      waterfall_distributions: {
        Row: {
          id: string;
          cycle_id: string;
          status: Database["public"]["Enums"]["distribution_status"];
          gross_revenue: number;
          capital_raised: number;
          operational_liabilities: number;
          profit_investor_percent: number;
          profit_operator_percent: number;
          reserve_percent: number;
          liabilities_paid: number;
          principal_returned: number;
          reserve_set_aside: number;
          net_profit: number;
          investor_profit_pool: number;
          operator_fee: number;
          total_paid_out: number;
          principal_at_risk: boolean;
          note: string | null;
          run_by: string;
          executed_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          cycle_id: string;
          status?: Database["public"]["Enums"]["distribution_status"];
          gross_revenue?: number;
          capital_raised?: number;
          operational_liabilities?: number;
          profit_investor_percent: number;
          profit_operator_percent: number;
          reserve_percent: number;
          liabilities_paid?: number;
          principal_returned?: number;
          reserve_set_aside?: number;
          net_profit?: number;
          investor_profit_pool?: number;
          operator_fee?: number;
          total_paid_out?: number;
          principal_at_risk?: boolean;
          note?: string | null;
          run_by: string;
          executed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          cycle_id?: string;
          status?: Database["public"]["Enums"]["distribution_status"];
          gross_revenue?: number;
          capital_raised?: number;
          operational_liabilities?: number;
          profit_investor_percent?: number;
          profit_operator_percent?: number;
          reserve_percent?: number;
          liabilities_paid?: number;
          principal_returned?: number;
          reserve_set_aside?: number;
          net_profit?: number;
          investor_profit_pool?: number;
          operator_fee?: number;
          total_paid_out?: number;
          principal_at_risk?: boolean;
          note?: string | null;
          run_by?: string;
          executed_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      waterfall_lines: {
        Row: {
          id: string;
          distribution_id: string;
          cycle_id: string;
          member_id: string;
          capital: number;
          equity_percent: number;
          principal_amount: number;
          profit_amount: number;
          total_amount: number;
          payout_status: Database["public"]["Enums"]["payout_status"];
          payout_reference: string | null;
          paid_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          distribution_id: string;
          cycle_id: string;
          member_id: string;
          capital?: number;
          equity_percent?: number;
          principal_amount?: number;
          profit_amount?: number;
          total_amount?: number;
          payout_status?: Database["public"]["Enums"]["payout_status"];
          payout_reference?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          distribution_id?: string;
          cycle_id?: string;
          member_id?: string;
          capital?: number;
          equity_percent?: number;
          principal_amount?: number;
          profit_amount?: number;
          total_amount?: number;
          payout_status?: Database["public"]["Enums"]["payout_status"];
          payout_reference?: string | null;
          paid_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      weather_snapshots: {
        Row: {
          id: string;
          cycle_id: string | null;
          captured_on: string;
          rainfall_mm: number | null;
          temp_min_c: number | null;
          temp_max_c: number | null;
          humidity_percent: number | null;
          source: string;
          note: string | null;
          recorded_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          cycle_id?: string | null;
          captured_on?: string;
          rainfall_mm?: number | null;
          temp_min_c?: number | null;
          temp_max_c?: number | null;
          humidity_percent?: number | null;
          source?: string;
          note?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          cycle_id?: string | null;
          captured_on?: string;
          rainfall_mm?: number | null;
          temp_min_c?: number | null;
          temp_max_c?: number | null;
          humidity_percent?: number | null;
          source?: string;
          note?: string | null;
          recorded_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      cycle_funding: {
        Row: {
          cycle_id: string | null;
          code: string | null;
          target_capital: number | null;
          minimum_ticket: number | null;
          raised_capital: number | null;
          investor_count: number | null;
          funded_percent: number | null;
        };
        Relationships: [];
      };
      cycle_harvest: {
        Row: {
          cycle_id: string | null;
          harvest_date: string | null;
          total_weight_kg: number | null;
          total_count: number | null;
          scale_ticket_ref: string | null;
          buyer: string | null;
          buyer_note: string | null;
          gross_revenue: number | null;
          revenue_received_on: string | null;
        };
        Relationships: [];
      };
      cycle_returns: {
        Row: {
          cycle_id: string | null;
          gross_revenue: number | null;
          capital_raised: number | null;
          operational_liabilities: number | null;
          liabilities_paid: number | null;
          principal_returned: number | null;
          reserve_set_aside: number | null;
          net_profit: number | null;
          investor_profit_pool: number | null;
          operator_fee: number | null;
          profit_investor_percent: number | null;
          profit_operator_percent: number | null;
          reserve_percent: number | null;
          principal_at_risk: boolean | null;
          total_paid_out: number | null;
          executed_at: string | null;
        };
        Relationships: [];
      };
      cycle_stock_level: {
        Row: {
          cycle_id: string | null;
          code: string | null;
          name: string | null;
          commodity: Database["public"]["Enums"]["commodity_type"] | null;
          log_date: string | null;
          population_count: number | null;
          biomass_kg: number | null;
          sample_avg_weight_g: number | null;
          crates_collected: number | null;
          bags_harvested: number | null;
        };
        Relationships: [];
      };
      platform_returns: {
        Row: {
          settled_cycles: number | null;
          capital_settled: number | null;
          capital_returned: number | null;
          investor_profit_paid: number | null;
          operator_fee_paid: number | null;
          net_profit_total: number | null;
        };
        Relationships: [];
      };
      platform_scale: {
        Row: {
          members: number | null;
          cycles_total: number | null;
          cycles_active: number | null;
        };
        Relationships: [];
      };
      public_milestones: {
        Row: {
          id: string | null;
          cycle_id: string | null;
          cycle_code: string | null;
          cycle_name: string | null;
          commodity: Database["public"]["Enums"]["commodity_type"] | null;
          log_type: Database["public"]["Enums"]["log_type"] | null;
          log_date: string | null;
          summary: string | null;
          created_at: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      apply_rollover: {
        Args: {
          _amount?: number;
          _destination_cycle_id?: string;
          _member_id?: string;
          _mode?: Database["public"]["Enums"]["rollover_mode"];
          _source_cycle_id?: string;
        };
        Returns: Database["public"]["Tables"]["cycle_investments"]["Row"];
      };
      cycle_position_book: {
        Args: { _cycle_id?: string };
        Returns: {
          member_id: string;
          full_name: string;
          member_capital: number;
          equity_percent: number;
        }[];
      };
      ensure_profile: {
        Args: { _full_name?: string; _user_id?: string };
        Returns: Database["public"]["Enums"]["app_role"];
      };
      has_role: {
        Args: { _role?: Database["public"]["Enums"]["app_role"]; _user_id?: string };
        Returns: boolean;
      };
      my_cycle_position: {
        Args: { _cycle_id?: string };
        Returns: {
          member_capital: number;
          cycle_capital: number;
          equity_percent: number;
          funded_percent: number;
          investor_count: number;
        }[];
      };
      publish_farm_cycle: {
        Args: { _cycle_id?: string };
        Returns: Database["public"]["Tables"]["farm_cycles"]["Row"];
      };
      run_cycle_waterfall: {
        Args: { _cycle_id?: string; _gross_revenue?: number; _note?: string };
        Returns: Database["public"]["Tables"]["waterfall_distributions"]["Row"];
      };
      settle_share_transfer: {
        Args: { _transfer_id?: string };
        Returns: Database["public"]["Tables"]["share_transfers"]["Row"];
      };
    };
    Enums: {
      app_role: "admin" | "operator" | "member" | "contributor";
      commodity_type: "catfish" | "tilapia" | "broiler" | "layer" | "grain" | "greenhouse";
      cycle_status: "draft" | "open" | "funded" | "active" | "harvested" | "settled" | "cancelled";
      distribution_status: "draft" | "executed" | "paid";
      incident_severity: "low" | "moderate" | "serious" | "critical";
      incident_status: "open" | "mitigating" | "resolved";
      investment_method: "paystack" | "manual" | "rollover";
      investment_status: "pending" | "success" | "failed";
      log_type:
        "feed" | "growth_sample" | "mortality" | "medication" | "general" | "harvest" | "sale";
      payment_method: "paystack" | "manual";
      payment_status: "pending" | "success" | "failed";
      payout_status: "pending" | "paid" | "withheld";
      review_status: "pending" | "approved" | "flagged";
      rollover_mode: "off" | "principal" | "profit" | "both";
      stage_id:
        | "funding_open"
        | "stocking"
        | "operational"
        | "harvest_weighin"
        | "sale_settlement"
        | "waterfall_distribution";
      transfer_status: "offered" | "claimed" | "settled" | "withdrawn";
      visit_status: "requested" | "confirmed" | "declined" | "completed" | "cancelled";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "operator", "member", "contributor"],
      commodity_type: ["catfish", "tilapia", "broiler", "layer", "grain", "greenhouse"],
      cycle_status: ["draft", "open", "funded", "active", "harvested", "settled", "cancelled"],
      distribution_status: ["draft", "executed", "paid"],
      incident_severity: ["low", "moderate", "serious", "critical"],
      incident_status: ["open", "mitigating", "resolved"],
      investment_method: ["paystack", "manual", "rollover"],
      investment_status: ["pending", "success", "failed"],
      log_type: ["feed", "growth_sample", "mortality", "medication", "general", "harvest", "sale"],
      payment_method: ["paystack", "manual"],
      payment_status: ["pending", "success", "failed"],
      payout_status: ["pending", "paid", "withheld"],
      review_status: ["pending", "approved", "flagged"],
      rollover_mode: ["off", "principal", "profit", "both"],
      stage_id: [
        "funding_open",
        "stocking",
        "operational",
        "harvest_weighin",
        "sale_settlement",
        "waterfall_distribution",
      ],
      transfer_status: ["offered", "claimed", "settled", "withdrawn"],
      visit_status: ["requested", "confirmed", "declined", "completed", "cancelled"],
    },
  },
} as const;
