
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "api": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "accept_invitations":
{ Args: { "p_email": string,"p_user_id": string }; Returns: {
              "invitation_id": string,"organization_id": string,"role": Database["public"]['Enums']["org_role"]
            }[]
                           },
"record_audit_event":
{ Args: { "p_action": string,"p_actor_id": string,"p_organization_id": string,"p_outcome": string,"p_reason": string,"p_target_table": string }; Returns: undefined
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
            "academic_years": {
                  Row: {
                    "created_at": string,"ends_on": string,"id": string,"name": string,"organization_id": string,"starts_on": string,"status": Database["public"]['Enums']["academic_year_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"ends_on": string,"id"?: string,"name": string,"organization_id": string,"starts_on": string,"status"?: Database["public"]['Enums']["academic_year_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"ends_on"?: string,"id"?: string,"name"?: string,"organization_id"?: string,"starts_on"?: string,"status"?: Database["public"]['Enums']["academic_year_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "academic_years_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"facilities": {
                  Row: {
                    "address": string | null,"archived_at": string | null,"created_at": string,"id": string,"name": string,"organization_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "address"?: string | null,"archived_at"?: string | null,"created_at"?: string,"id"?: string,"name": string,"organization_id": string,"updated_at"?: string
                  }
                  Update: {
                    "address"?: string | null,"archived_at"?: string | null,"created_at"?: string,"id"?: string,"name"?: string,"organization_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "facilities_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"groups": {
                  Row: {
                    "academic_year_id": string,"archived_at": string | null,"capacity": number | null,"created_at": string,"facility_id": string,"id": string,"name": string,"organization_id": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "academic_year_id": string,"archived_at"?: string | null,"capacity"?: number | null,"created_at"?: string,"facility_id": string,"id"?: string,"name": string,"organization_id": string,"updated_at"?: string
                  }
                  Update: {
                    "academic_year_id"?: string,"archived_at"?: string | null,"capacity"?: number | null,"created_at"?: string,"facility_id"?: string,"id"?: string,"name"?: string,"organization_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "groups_organization_id_academic_year_id_fkey"
      columns: ["organization_id","academic_year_id"]
isOneToOne: false
      referencedRelation: "academic_years"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "groups_organization_id_facility_id_fkey"
      columns: ["organization_id","facility_id"]
isOneToOne: false
      referencedRelation: "facilities"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "groups_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"created_by": string,"email": string,"expires_at": string,"first_name": string,"id": string,"last_name": string,"organization_id": string,"revoked_at": string | null,"revoked_by": string | null,"role": Database["public"]['Enums']["org_role"],"status": Database["public"]['Enums']["invitation_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"created_by"?: string,"email": string,"expires_at"?: string,"first_name": string,"id"?: string,"last_name": string,"organization_id": string,"revoked_at"?: string | null,"revoked_by"?: string | null,"role": Database["public"]['Enums']["org_role"],"status"?: Database["public"]['Enums']["invitation_status"],"updated_at"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"created_by"?: string,"email"?: string,"expires_at"?: string,"first_name"?: string,"id"?: string,"last_name"?: string,"organization_id"?: string,"revoked_at"?: string | null,"revoked_by"?: string | null,"role"?: Database["public"]['Enums']["org_role"],"status"?: Database["public"]['Enums']["invitation_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "invitations_accepted_by_fkey"
      columns: ["accepted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "invitations_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"memberships": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"notice_ack_at": string | null,"notice_ack_version": string | null,"organization_id": string,"profile_id": string,"role": Database["public"]['Enums']["org_role"],"status": Database["public"]['Enums']["membership_status"],"updated_at": string,"valid_during": unknown
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"notice_ack_at"?: string | null,"notice_ack_version"?: string | null,"organization_id": string,"profile_id": string,"role": Database["public"]['Enums']["org_role"],"status"?: Database["public"]['Enums']["membership_status"],"updated_at"?: string,"valid_during"?: unknown
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"notice_ack_at"?: string | null,"notice_ack_version"?: string | null,"organization_id"?: string,"profile_id"?: string,"role"?: Database["public"]['Enums']["org_role"],"status"?: Database["public"]['Enums']["membership_status"],"updated_at"?: string,"valid_during"?: unknown
                  }
                  Relationships: [
                    {
      foreignKeyName: "memberships_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "memberships_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"organizations": {
                  Row: {
                    "absence_cutoff_local": string | null,"created_at": string,"id": string,"invitation_limit_per_hour": number,"locale": string,"name": string,"privacy_notice_version": string | null,"quiet_hours_end": string,"quiet_hours_start": string,"slug": string,"status": string,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "absence_cutoff_local"?: string | null,"created_at"?: string,"id"?: string,"invitation_limit_per_hour"?: number,"locale"?: string,"name": string,"privacy_notice_version"?: string | null,"quiet_hours_end"?: string,"quiet_hours_start"?: string,"slug": string,"status"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "absence_cutoff_local"?: string | null,"created_at"?: string,"id"?: string,"invitation_limit_per_hour"?: number,"locale"?: string,"name"?: string,"privacy_notice_version"?: string | null,"quiet_hours_end"?: string,"quiet_hours_start"?: string,"slug"?: string,"status"?: string,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "organizations_privacy_notice_fk"
      columns: ["id","privacy_notice_version"]
isOneToOne: false
      referencedRelation: "privacy_notices"
      referencedColumns: ["organization_id","version"]
    }
                  ]
                },"privacy_notices": {
                  Row: {
                    "body": string,"created_at": string,"id": string,"is_demo": boolean,"organization_id": string,"title": string,"version": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: string,"is_demo"?: boolean,"organization_id": string,"title": string,"version": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: string,"is_demo"?: boolean,"organization_id"?: string,"title"?: string,"version"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "privacy_notices_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "created_at": string,"display_name": string | null,"first_name": string,"id": string,"last_name": string,"locale": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"display_name"?: string | null,"first_name": string,"id": string,"last_name": string,"locale"?: string,"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"display_name"?: string | null,"first_name"?: string,"id"?: string,"last_name"?: string,"locale"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"staff_assignments": {
                  Row: {
                    "approved_by": string | null,"assignment_type": Database["public"]['Enums']["assignment_type"],"created_at": string,"created_by": string | null,"group_id": string,"id": string,"membership_id": string,"organization_id": string,"updated_at": string,"valid_during": unknown
                  }
                  ComputedFields: never
                  Insert: {
                    "approved_by"?: string | null,"assignment_type"?: Database["public"]['Enums']["assignment_type"],"created_at"?: string,"created_by"?: string | null,"group_id": string,"id"?: string,"membership_id": string,"organization_id": string,"updated_at"?: string,"valid_during": unknown
                  }
                  Update: {
                    "approved_by"?: string | null,"assignment_type"?: Database["public"]['Enums']["assignment_type"],"created_at"?: string,"created_by"?: string | null,"group_id"?: string,"id"?: string,"membership_id"?: string,"organization_id"?: string,"updated_at"?: string,"valid_during"?: unknown
                  }
                  Relationships: [
                    {
      foreignKeyName: "staff_assignments_approved_by_fkey"
      columns: ["approved_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_assignments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_assignments_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "staff_assignments_organization_id_group_id_fkey"
      columns: ["organization_id","group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "staff_assignments_organization_id_membership_id_fkey"
      columns: ["organization_id","membership_id"]
isOneToOne: false
      referencedRelation: "memberships"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                }
          }
          Views: {
            "audit_events": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_role": string,"correlation_id": string | null,"details": NonNullable<Json>,"id": number,"occurred_at": string,"organization_id": string | null,"outcome": string,"target_id": string | null,"target_table": string
                  }
                  ComputedFields: never
                  Insert: {
                           "action"?: string | null,"actor_id"?: string | null,"actor_role"?: string | null,"correlation_id"?: string | null,"details"?: Json | null,"id"?: number | null,"occurred_at"?: string | null,"organization_id"?: string | null,"outcome"?: string | null,"target_id"?: string | null,"target_table"?: string | null
                         }
                        Update: {
                           "action"?: string | null,"actor_id"?: string | null,"actor_role"?: string | null,"correlation_id"?: string | null,"details"?: Json | null,"id"?: number | null,"occurred_at"?: string | null,"organization_id"?: string | null,"outcome"?: string | null,"target_id"?: string | null,"target_table"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "audit_events_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            [_ in never]: never
          }
          Enums: {
            "academic_year_status": "planned"|"active"|"closed","assignment_type": "regular"|"substitute","invitation_status": "pending"|"accepted"|"revoked","membership_status": "active"|"suspended"|"ended","org_role": "org_admin"|"director"|"educator"|"guardian"
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
  "api": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "academic_year_status": ["planned", "active", "closed"],"assignment_type": ["regular", "substitute"],"invitation_status": ["pending", "accepted", "revoked"],"membership_status": ["active", "suspended", "ended"],"org_role": ["org_admin", "director", "educator", "guardian"]
          }
        }
} as const
