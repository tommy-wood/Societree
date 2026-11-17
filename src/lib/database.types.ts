
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "app_settings": {
                  Row: {
                    "key": string,"updated_at": string,"value": NonNullable<Json>
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"value": NonNullable<Json>
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"value"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"jobs": {
                  Row: {
                    "completed_at": string | null,"completed_by": string | null,"created_at": string,"created_by": string | null,"done": boolean,"due_date": string | null,"id": string,"site_id": string,"text": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"done"?: boolean,"due_date"?: string | null,"id"?: string,"site_id": string,"text": string
                  }
                  Update: {
                    "completed_at"?: string | null,"completed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"done"?: boolean,"due_date"?: string | null,"id"?: string,"site_id"?: string,"text"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "jobs_completed_by_fkey"
      columns: ["completed_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "jobs_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"role": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id": string,"name"?: string,"role"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"role"?: string
                  }
                  Relationships: [
                    
                  ]
                },"sites": {
                  Row: {
                    "address": string,"contact": string,"contact_email": string,"created_at": string,"id": string,"last_visit": string | null,"lat": number | null,"lng": number | null,"name": string,"notes": string,"priority": string | null,"slug": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string,"contact"?: string,"contact_email"?: string,"created_at"?: string,"id"?: string,"last_visit"?: string | null,"lat"?: number | null,"lng"?: number | null,"name": string,"notes"?: string,"priority"?: string | null,"slug"?: string | null
                  }
                  Update: {
                    "address"?: string,"contact"?: string,"contact_email"?: string,"created_at"?: string,"id"?: string,"last_visit"?: string | null,"lat"?: number | null,"lng"?: number | null,"name"?: string,"notes"?: string,"priority"?: string | null,"slug"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"stock_items": {
                  Row: {
                    "category": string,"created_at": string,"id": string,"kept_at": string,"low_at": number,"name": string,"notes": string,"quantity": number,"unit": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "category"?: string,"created_at"?: string,"id"?: string,"kept_at"?: string,"low_at"?: number,"name": string,"notes"?: string,"quantity"?: number,"unit"?: string,"updated_at"?: string
                  }
                  Update: {
                    "category"?: string,"created_at"?: string,"id"?: string,"kept_at"?: string,"low_at"?: number,"name"?: string,"notes"?: string,"quantity"?: number,"unit"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"visit_photos": {
                  Row: {
                    "created_at": string,"id": string,"storage_path": string,"uploaded_by": string | null,"visit_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"storage_path": string,"uploaded_by"?: string | null,"visit_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"storage_path"?: string,"uploaded_by"?: string | null,"visit_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "visit_photos_uploaded_by_fkey"
      columns: ["uploaded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visit_photos_visit_id_fkey"
      columns: ["visit_id"]
isOneToOne: false
      referencedRelation: "visits"
      referencedColumns: ["id"]
    }
                  ]
                },"visits": {
                  Row: {
                    "created_at": string,"date": string,"id": string,"legacy_logged_by": string | null,"legacy_photo_count": number,"logged_by": string | null,"notes": string,"priority_at_visit": string | null,"site_id": string,"work_carried_out": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"date"?: string,"id"?: string,"legacy_logged_by"?: string | null,"legacy_photo_count"?: number,"logged_by"?: string | null,"notes"?: string,"priority_at_visit"?: string | null,"site_id": string,"work_carried_out"?: string
                  }
                  Update: {
                    "created_at"?: string,"date"?: string,"id"?: string,"legacy_logged_by"?: string | null,"legacy_photo_count"?: number,"logged_by"?: string | null,"notes"?: string,"priority_at_visit"?: string | null,"site_id"?: string,"work_carried_out"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "visits_logged_by_fkey"
      columns: ["logged_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "visits_site_id_fkey"
      columns: ["site_id"]
isOneToOne: false
      referencedRelation: "sites"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_member":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"link_legacy_visits":
{ Args: { "p_legacy_name": string,"p_profile_id": string }; Returns: number
                           },
"recompute_site_from_visits":
{ Args: { "p_site_id": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            
          }
        }
} as const
