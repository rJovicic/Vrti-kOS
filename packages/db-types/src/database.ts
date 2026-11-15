
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
"archive_announcement":
{ Args: { "p_id": string }; Returns: string
                           },
"cancel_absence":
{ Args: { "p_absence_id": string }; Returns: string
                           },
"cancel_future_record":
{ Args: { "p_kind": string,"p_reason": Database["public"]['Enums']["cancellation_reason"],"p_record_id": string }; Returns: undefined
                           },
"child_day_status":
{ Args: { "p_day"?: string,"p_group_id"?: string }; Returns: {
              "absence_is_late": boolean,"absence_reported": boolean,"arrived_at": string,"child_id": string,"departed_at": string,"group_id": string,"last_record_id": string,"last_record_kind": Database["public"]['Enums']["attendance_kind"],"local_date": string,"organization_id": string,"status": string
            }[]
                           },
"correct_attendance":
{ Args: { "p_idempotency_key": string,"p_new_occurred_at"?: string,"p_reason": Database["public"]['Enums']["attendance_correction_reason"],"p_record_id": string,"p_source"?: string }; Returns: string
                           },
"edit_announcement":
{ Args: { "p_body": string,"p_id": string,"p_title": string }; Returns: string
                           },
"handover_candidates":
{ Args: { "p_child_id": string }; Returns: {
              "first_name": string,"id": string,"kind": string,"last_name": string,"restricted": boolean
            }[]
                           },
"mark_notifications_read":
{ Args: { "p_ids"?: (string)[] }; Returns: number
                           },
"publish_announcement":
{ Args: { "p_id": string }; Returns: string
                           },
"record_absence_on_behalf":
{ Args: { "p_child_id": string,"p_ends_on": string,"p_starts_on": string }; Returns: string
                           },
"record_attendance":
{ Args: { "p_child_id": string,"p_handover_child_guardian_id"?: string,"p_handover_pickup_id"?: string,"p_idempotency_key": string,"p_kind": Database["public"]['Enums']["attendance_kind"],"p_occurred_at"?: string,"p_source"?: string }; Returns: {
              "kind": Database["public"]['Enums']["attendance_kind"],"occurred_at": string,"record_id": string,"replayed": boolean
            }[]
                           },
"record_audit_event":
{ Args: { "p_action": string,"p_actor_id": string,"p_organization_id": string,"p_outcome": string,"p_reason": string,"p_target_table": string }; Returns: undefined
                           },
"record_missed_attendance":
{ Args: { "p_child_id": string,"p_idempotency_key": string,"p_kind": Database["public"]['Enums']["attendance_kind"],"p_occurred_at": string,"p_reason": Database["public"]['Enums']["attendance_correction_reason"],"p_source"?: string }; Returns: string
                           },
"report_absence":
{ Args: { "p_child_id": string,"p_ends_on": string,"p_starts_on": string }; Returns: string
                           },
"save_announcement_draft":
{ Args: { "p_audience_ids": (string)[],"p_audience_roles": (string)[],"p_audience_scope": string,"p_body": string,"p_id"?: string,"p_organization_id": string,"p_title": string }; Returns: string
                           },
"transfer_child":
{ Args: { "p_child_id": string,"p_effective_on": string,"p_group_id": string }; Returns: string
                           },
"undo_attendance":
{ Args: { "p_idempotency_key": string,"p_record_id": string }; Returns: string
                           },
"withdraw_child":
{ Args: { "p_child_id": string,"p_last_day": string }; Returns: undefined
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
            "absence_records": {
                  Row: {
                    "cancelled_at": string | null,"cancelled_by": string | null,"child_id": string,"created_at": string,"ends_on": string,"id": string,"is_late": boolean,"organization_id": string,"reported_by": string,"source": string,"split_from": string | null,"starts_on": string,"status": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cancelled_at"?: string | null,"cancelled_by"?: string | null,"child_id": string,"created_at"?: string,"ends_on": string,"id"?: string,"is_late"?: boolean,"organization_id": string,"reported_by": string,"source": string,"split_from"?: string | null,"starts_on": string,"status"?: string,"updated_at"?: string
                  }
                  Update: {
                    "cancelled_at"?: string | null,"cancelled_by"?: string | null,"child_id"?: string,"created_at"?: string,"ends_on"?: string,"id"?: string,"is_late"?: boolean,"organization_id"?: string,"reported_by"?: string,"source"?: string,"split_from"?: string | null,"starts_on"?: string,"status"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "absence_records_cancelled_by_fkey"
      columns: ["cancelled_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "absence_records_organization_id_child_id_fkey"
      columns: ["organization_id","child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "absence_records_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "absence_records_organization_id_split_from_fkey"
      columns: ["organization_id","split_from"]
isOneToOne: false
      referencedRelation: "absence_records"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "absence_records_reported_by_fkey"
      columns: ["reported_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"academic_years": {
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
                },"access_restrictions": {
                  Row: {
                    "child_guardian_id": string,"created_at": string,"created_by": string | null,"id": string,"organization_id": string,"reference": string | null,"scope": Database["public"]['Enums']["restriction_scope"],"updated_at": string,"valid_during": unknown
                  }
                  ComputedFields: never
                  Insert: {
                    "child_guardian_id": string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"organization_id": string,"reference"?: string | null,"scope"?: Database["public"]['Enums']["restriction_scope"],"updated_at"?: string,"valid_during": unknown
                  }
                  Update: {
                    "child_guardian_id"?: string,"created_at"?: string,"created_by"?: string | null,"id"?: string,"organization_id"?: string,"reference"?: string | null,"scope"?: Database["public"]['Enums']["restriction_scope"],"updated_at"?: string,"valid_during"?: unknown
                  }
                  Relationships: [
                    {
      foreignKeyName: "access_restrictions_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "access_restrictions_organization_id_child_guardian_id_fkey"
      columns: ["organization_id","child_guardian_id"]
isOneToOne: false
      referencedRelation: "child_guardian_overview"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "access_restrictions_organization_id_child_guardian_id_fkey"
      columns: ["organization_id","child_guardian_id"]
isOneToOne: false
      referencedRelation: "child_guardians"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "access_restrictions_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"announcement_revisions": {
                  Row: {
                    "announcement_id": string,"body": string,"id": string,"organization_id": string,"revised_at": string,"revised_by": string | null,"title": string
                  }
                  ComputedFields: never
                  Insert: {
                    "announcement_id": string,"body": string,"id"?: string,"organization_id": string,"revised_at"?: string,"revised_by"?: string | null,"title": string
                  }
                  Update: {
                    "announcement_id"?: string,"body"?: string,"id"?: string,"organization_id"?: string,"revised_at"?: string,"revised_by"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcement_revisions_organization_id_announcement_id_fkey"
      columns: ["organization_id","announcement_id"]
isOneToOne: false
      referencedRelation: "announcements"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "announcement_revisions_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcement_revisions_revised_by_fkey"
      columns: ["revised_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"announcements": {
                  Row: {
                    "archived_at": string | null,"audience_ids": (string)[],"audience_roles": (string)[],"audience_scope": string,"author_id": string | null,"body": string,"created_at": string,"edited_at": string | null,"id": string,"organization_id": string,"published_at": string | null,"status": string,"title": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "archived_at"?: string | null,"audience_ids"?: (string)[],"audience_roles": (string)[],"audience_scope": string,"author_id"?: string | null,"body": string,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"organization_id": string,"published_at"?: string | null,"status"?: string,"title": string,"updated_at"?: string
                  }
                  Update: {
                    "archived_at"?: string | null,"audience_ids"?: (string)[],"audience_roles"?: (string)[],"audience_scope"?: string,"author_id"?: string | null,"body"?: string,"created_at"?: string,"edited_at"?: string | null,"id"?: string,"organization_id"?: string,"published_at"?: string | null,"status"?: string,"title"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "announcements_author_id_fkey"
      columns: ["author_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "announcements_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"attendance_records": {
                  Row: {
                    "child_id": string,"correction_reason": Database["public"]['Enums']["attendance_correction_reason"] | null,"corrects_id": string | null,"handover_child_guardian_id": string | null,"handover_pickup_id": string | null,"id": string,"idempotency_key": string,"kind": Database["public"]['Enums']["attendance_kind"],"local_date": string,"occurred_at": string,"organization_id": string,"recorded_at": string,"recorded_by": string,"source": string
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"correction_reason"?: Database["public"]['Enums']["attendance_correction_reason"] | null,"corrects_id"?: string | null,"handover_child_guardian_id"?: string | null,"handover_pickup_id"?: string | null,"id"?: string,"idempotency_key": string,"kind": Database["public"]['Enums']["attendance_kind"],"local_date": string,"occurred_at": string,"organization_id": string,"recorded_at"?: string,"recorded_by": string,"source": string
                  }
                  Update: {
                    "child_id"?: string,"correction_reason"?: Database["public"]['Enums']["attendance_correction_reason"] | null,"corrects_id"?: string | null,"handover_child_guardian_id"?: string | null,"handover_pickup_id"?: string | null,"id"?: string,"idempotency_key"?: string,"kind"?: Database["public"]['Enums']["attendance_kind"],"local_date"?: string,"occurred_at"?: string,"organization_id"?: string,"recorded_at"?: string,"recorded_by"?: string,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "attendance_records_organization_id_child_id_fkey"
      columns: ["organization_id","child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "attendance_records_organization_id_corrects_id_fkey"
      columns: ["organization_id","corrects_id"]
isOneToOne: false
      referencedRelation: "attendance_records"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "attendance_records_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "attendance_records_organization_id_handover_child_guardian_fkey"
      columns: ["organization_id","handover_child_guardian_id"]
isOneToOne: false
      referencedRelation: "child_guardian_overview"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "attendance_records_organization_id_handover_child_guardian_fkey"
      columns: ["organization_id","handover_child_guardian_id"]
isOneToOne: false
      referencedRelation: "child_guardians"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "attendance_records_organization_id_handover_pickup_id_fkey"
      columns: ["organization_id","handover_pickup_id"]
isOneToOne: false
      referencedRelation: "pickup_authorizations"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "attendance_records_recorded_by_fkey"
      columns: ["recorded_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"child_guardians": {
                  Row: {
                    "can_report_absence": boolean,"can_view": boolean,"child_id": string,"created_at": string,"created_by": string | null,"guardian_id": string,"id": string,"organization_id": string,"receives_messages": boolean,"updated_at": string,"valid_during": unknown
                  }
                  ComputedFields: never
                  Insert: {
                    "can_report_absence"?: boolean,"can_view"?: boolean,"child_id": string,"created_at"?: string,"created_by"?: string | null,"guardian_id": string,"id"?: string,"organization_id": string,"receives_messages"?: boolean,"updated_at"?: string,"valid_during": unknown
                  }
                  Update: {
                    "can_report_absence"?: boolean,"can_view"?: boolean,"child_id"?: string,"created_at"?: string,"created_by"?: string | null,"guardian_id"?: string,"id"?: string,"organization_id"?: string,"receives_messages"?: boolean,"updated_at"?: string,"valid_during"?: unknown
                  }
                  Relationships: [
                    {
      foreignKeyName: "child_guardians_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "child_guardians_organization_id_child_id_fkey"
      columns: ["organization_id","child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "child_guardians_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "child_guardians_organization_id_guardian_id_fkey"
      columns: ["organization_id","guardian_id"]
isOneToOne: false
      referencedRelation: "guardian_directory"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "child_guardians_organization_id_guardian_id_fkey"
      columns: ["organization_id","guardian_id"]
isOneToOne: false
      referencedRelation: "guardians"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"children": {
                  Row: {
                    "created_at": string,"created_by": string | null,"first_name": string,"id": string,"internal_ref": string | null,"last_name": string,"organization_id": string,"status": Database["public"]['Enums']["child_status"],"updated_at": string,"withdrawn_on": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"first_name": string,"id"?: string,"internal_ref"?: string | null,"last_name": string,"organization_id": string,"status"?: Database["public"]['Enums']["child_status"],"updated_at"?: string,"withdrawn_on"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"first_name"?: string,"id"?: string,"internal_ref"?: string | null,"last_name"?: string,"organization_id"?: string,"status"?: Database["public"]['Enums']["child_status"],"updated_at"?: string,"withdrawn_on"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "children_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "children_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    }
                  ]
                },"enrollments": {
                  Row: {
                    "child_id": string,"created_at": string,"created_by": string | null,"group_id": string,"id": string,"organization_id": string,"updated_at": string,"valid_during": unknown
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"created_at"?: string,"created_by"?: string | null,"group_id": string,"id"?: string,"organization_id": string,"updated_at"?: string,"valid_during": unknown
                  }
                  Update: {
                    "child_id"?: string,"created_at"?: string,"created_by"?: string | null,"group_id"?: string,"id"?: string,"organization_id"?: string,"updated_at"?: string,"valid_during"?: unknown
                  }
                  Relationships: [
                    {
      foreignKeyName: "enrollments_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_organization_id_child_id_fkey"
      columns: ["organization_id","child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "enrollments_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "enrollments_organization_id_group_id_fkey"
      columns: ["organization_id","group_id"]
isOneToOne: false
      referencedRelation: "groups"
      referencedColumns: ["organization_id","id"]
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
                },"guardians": {
                  Row: {
                    "created_at": string,"created_by": string | null,"first_name": string,"id": string,"last_name": string,"organization_id": string,"profile_id": string | null,"status": Database["public"]['Enums']["guardian_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"first_name": string,"id"?: string,"last_name": string,"organization_id": string,"profile_id"?: string | null,"status"?: Database["public"]['Enums']["guardian_status"],"updated_at"?: string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"first_name"?: string,"id"?: string,"last_name"?: string,"organization_id"?: string,"profile_id"?: string | null,"status"?: Database["public"]['Enums']["guardian_status"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "guardians_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guardians_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "guardians_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"invitations": {
                  Row: {
                    "accepted_at": string | null,"accepted_by": string | null,"created_at": string,"created_by": string,"email": string,"expires_at": string,"first_name": string,"guardian_id": string | null,"id": string,"last_name": string,"organization_id": string,"revoked_at": string | null,"revoked_by": string | null,"role": Database["public"]['Enums']["org_role"],"status": Database["public"]['Enums']["invitation_status"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"created_by"?: string,"email": string,"expires_at"?: string,"first_name": string,"guardian_id"?: string | null,"id"?: string,"last_name": string,"organization_id": string,"revoked_at"?: string | null,"revoked_by"?: string | null,"role": Database["public"]['Enums']["org_role"],"status"?: Database["public"]['Enums']["invitation_status"],"updated_at"?: string
                  }
                  Update: {
                    "accepted_at"?: string | null,"accepted_by"?: string | null,"created_at"?: string,"created_by"?: string,"email"?: string,"expires_at"?: string,"first_name"?: string,"guardian_id"?: string | null,"id"?: string,"last_name"?: string,"organization_id"?: string,"revoked_at"?: string | null,"revoked_by"?: string | null,"role"?: Database["public"]['Enums']["org_role"],"status"?: Database["public"]['Enums']["invitation_status"],"updated_at"?: string
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
      foreignKeyName: "invitations_guardian_fk"
      columns: ["organization_id","guardian_id"]
isOneToOne: false
      referencedRelation: "guardian_directory"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "invitations_guardian_fk"
      columns: ["organization_id","guardian_id"]
isOneToOne: false
      referencedRelation: "guardians"
      referencedColumns: ["organization_id","id"]
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
                },"notification_preferences": {
                  Row: {
                    "profile_id": string,"push_enabled": boolean,"type": Database["public"]['Enums']["notification_type"],"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "profile_id": string,"push_enabled": boolean,"type": Database["public"]['Enums']["notification_type"],"updated_at"?: string
                  }
                  Update: {
                    "profile_id"?: string,"push_enabled"?: boolean,"type"?: Database["public"]['Enums']["notification_type"],"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "notification_preferences_profile_id_fkey"
      columns: ["profile_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string,"id": string,"organization_id": string,"push_attempts": number,"push_status": string,"read_at": string | null,"recipient_id": string,"resource_id": string,"resource_type": string,"type": Database["public"]['Enums']["notification_type"]
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: string,"organization_id": string,"push_attempts"?: number,"push_status"?: string,"read_at"?: string | null,"recipient_id": string,"resource_id": string,"resource_type": string,"type": Database["public"]['Enums']["notification_type"]
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"organization_id"?: string,"push_attempts"?: number,"push_status"?: string,"read_at"?: string | null,"recipient_id"?: string,"resource_id"?: string,"resource_type"?: string,"type"?: Database["public"]['Enums']["notification_type"]
                  }
                  Relationships: [
                    {
      foreignKeyName: "notifications_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "notifications_recipient_id_fkey"
      columns: ["recipient_id"]
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
                },"pickup_authorizations": {
                  Row: {
                    "child_id": string,"created_at": string,"created_by": string | null,"first_name": string,"id": string,"last_name": string,"organization_id": string,"updated_at": string,"valid_during": unknown
                  }
                  ComputedFields: never
                  Insert: {
                    "child_id": string,"created_at"?: string,"created_by"?: string | null,"first_name": string,"id"?: string,"last_name": string,"organization_id": string,"updated_at"?: string,"valid_during": unknown
                  }
                  Update: {
                    "child_id"?: string,"created_at"?: string,"created_by"?: string | null,"first_name"?: string,"id"?: string,"last_name"?: string,"organization_id"?: string,"updated_at"?: string,"valid_during"?: unknown
                  }
                  Relationships: [
                    {
      foreignKeyName: "pickup_authorizations_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pickup_authorizations_organization_id_child_id_fkey"
      columns: ["organization_id","child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "pickup_authorizations_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
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
                },"child_guardian_overview": {
                  Row: {
                    "can_report_absence": boolean,"can_view": boolean,"child_id": string,"guardian_id": string,"id": string,"is_restricted": boolean | null,"organization_id": string,"receives_messages": boolean,"valid_during": unknown
                  }
                  ComputedFields: never
                  Insert: {
                           "can_report_absence"?: boolean | null,"can_view"?: boolean | null,"child_id"?: string | null,"guardian_id"?: string | null,"id"?: string | null,"is_restricted"?: never,"organization_id"?: string | null,"receives_messages"?: boolean | null,"valid_during"?: unknown
                         }
                        Update: {
                           "can_report_absence"?: boolean | null,"can_view"?: boolean | null,"child_id"?: string | null,"guardian_id"?: string | null,"id"?: string | null,"is_restricted"?: never,"organization_id"?: string | null,"receives_messages"?: boolean | null,"valid_during"?: unknown
                         }
                        Relationships: [
                    {
      foreignKeyName: "child_guardians_organization_id_child_id_fkey"
      columns: ["organization_id","child_id"]
isOneToOne: false
      referencedRelation: "children"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "child_guardians_organization_id_fkey"
      columns: ["organization_id"]
isOneToOne: false
      referencedRelation: "organizations"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "child_guardians_organization_id_guardian_id_fkey"
      columns: ["organization_id","guardian_id"]
isOneToOne: false
      referencedRelation: "guardian_directory"
      referencedColumns: ["organization_id","id"]
    },{
      foreignKeyName: "child_guardians_organization_id_guardian_id_fkey"
      columns: ["organization_id","guardian_id"]
isOneToOne: false
      referencedRelation: "guardians"
      referencedColumns: ["organization_id","id"]
    }
                  ]
                },"guardian_directory": {
                  Row: {
                    "first_name": string,"has_account": boolean | null,"id": string,"last_name": string,"organization_id": string,"status": Database["public"]['Enums']["guardian_status"]
                  }
                  ComputedFields: never
                  Insert: {
                           "first_name"?: string | null,"has_account"?: never,"id"?: string | null,"last_name"?: string | null,"organization_id"?: string | null,"status"?: Database["public"]['Enums']["guardian_status"] | null
                         }
                        Update: {
                           "first_name"?: string | null,"has_account"?: never,"id"?: string | null,"last_name"?: string | null,"organization_id"?: string | null,"status"?: Database["public"]['Enums']["guardian_status"] | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "guardians_organization_id_fkey"
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
            "academic_year_status": "planned"|"active"|"closed","assignment_type": "regular"|"substitute","attendance_correction_reason": "entry_error"|"forgot"|"other","attendance_kind": "check_in"|"check_out"|"void","cancellation_reason": "entered_in_error"|"plan_changed"|"withdrawal_planned"|"other","child_status": "active"|"withdrawn","guardian_status": "active"|"ended","invitation_status": "pending"|"accepted"|"revoked","membership_status": "active"|"suspended"|"ended","notification_type": "announcement.published"|"absence.reported"|"message.received"|"daily_entry.published","org_role": "org_admin"|"director"|"educator"|"guardian","restriction_scope": "full"
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
            "academic_year_status": ["planned", "active", "closed"],"assignment_type": ["regular", "substitute"],"attendance_correction_reason": ["entry_error", "forgot", "other"],"attendance_kind": ["check_in", "check_out", "void"],"cancellation_reason": ["entered_in_error", "plan_changed", "withdrawal_planned", "other"],"child_status": ["active", "withdrawn"],"guardian_status": ["active", "ended"],"invitation_status": ["pending", "accepted", "revoked"],"membership_status": ["active", "suspended", "ended"],"notification_type": ["announcement.published", "absence.reported", "message.received", "daily_entry.published"],"org_role": ["org_admin", "director", "educator", "guardian"],"restriction_scope": ["full"]
          }
        }
} as const
