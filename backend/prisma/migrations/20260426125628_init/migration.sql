-- CreateEnum
CREATE TYPE "public"."case_flow_status" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "public"."case_flow_version_status" AS ENUM ('published', 'superseded', 'archived');

-- CreateEnum
CREATE TYPE "public"."case_status" AS ENUM ('intake', 'in_review', 'pending_approval', 'pending_action', 'escalated', 'resolved', 'closed', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."case_priority" AS ENUM ('low', 'normal', 'high', 'critical');

-- CreateEnum
CREATE TYPE "public"."case_task_status" AS ENUM ('pending', 'assigned', 'claimed', 'completed', 'rejected', 'cancelled', 'overdue');

-- CreateEnum
CREATE TYPE "public"."case_task_type" AS ENUM ('review', 'data_capture', 'approval_support', 'document_collection', 'decision_followup', 'escalation_followup');

-- CreateEnum
CREATE TYPE "public"."case_event_type" AS ENUM ('case_created', 'status_updated', 'task_created', 'task_claimed', 'task_completed', 'approval_requested', 'approval_decided', 'escalation_triggered', 'escalation_resolved', 'document_uploaded', 'automation_requested', 'automation_completed', 'automation_failed', 'note_added', 'case_resolved', 'case_closed', 'case_cancelled');

-- CreateEnum
CREATE TYPE "public"."case_approval_status" AS ENUM ('requested', 'approved', 'rejected', 'expired', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."case_escalation_status" AS ENUM ('triggered', 'resolved', 'cancelled');

-- CreateEnum
CREATE TYPE "public"."claim_policy" AS ENUM ('direct_assign', 'claim_required');

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" SERIAL NOT NULL,
    "actor_user_id" INTEGER,
    "action" VARCHAR NOT NULL,
    "entity_type" VARCHAR,
    "entity_id" INTEGER,
    "data_json" VARCHAR,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."roles" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" SERIAL NOT NULL,
    "email" VARCHAR NOT NULL,
    "password_hash" VARCHAR NOT NULL,
    "full_name" VARCHAR NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "role_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."teams" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" VARCHAR,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."team_memberships" (
    "id" SERIAL NOT NULL,
    "team_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "membership_role" VARCHAR,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."case_flows" (
    "id" SERIAL NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "name" VARCHAR NOT NULL,
    "description" VARCHAR,
    "case_type" VARCHAR NOT NULL,
    "status" "public"."case_flow_status" NOT NULL DEFAULT 'draft',
    "owner_user_id" INTEGER,
    "current_published_version_id" INTEGER,
    "draft_data_schema_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ(6),

    CONSTRAINT "case_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."case_flow_draft_nodes" (
    "id" SERIAL NOT NULL,
    "case_flow_id" INTEGER NOT NULL,
    "node_key" VARCHAR(100) NOT NULL,
    "kind" VARCHAR(50) NOT NULL,
    "name" VARCHAR,
    "config_json" JSONB NOT NULL,
    "pos_x" INTEGER NOT NULL DEFAULT 0,
    "pos_y" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_flow_draft_nodes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."case_flow_draft_edges" (
    "id" SERIAL NOT NULL,
    "case_flow_id" INTEGER NOT NULL,
    "edge_key" VARCHAR(100) NOT NULL,
    "from_node_key" VARCHAR(100) NOT NULL,
    "to_node_key" VARCHAR(100) NOT NULL,
    "condition_json" JSONB,
    "label" VARCHAR,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_flow_draft_edges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."case_flow_versions" (
    "id" SERIAL NOT NULL,
    "case_flow_id" INTEGER NOT NULL,
    "version_number" INTEGER NOT NULL,
    "status" "public"."case_flow_version_status" NOT NULL DEFAULT 'published',
    "graph_json" JSONB NOT NULL,
    "data_schema_json" JSONB,
    "change_summary" VARCHAR,
    "published_by_user_id" INTEGER,
    "published_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retired_at" TIMESTAMPTZ(6),

    CONSTRAINT "case_flow_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."cases" (
    "id" SERIAL NOT NULL,
    "case_flow_id" INTEGER NOT NULL,
    "case_flow_version_id" INTEGER NOT NULL,
    "case_reference" VARCHAR(100) NOT NULL,
    "case_type" VARCHAR NOT NULL,
    "title" VARCHAR,
    "status" "public"."case_status" NOT NULL DEFAULT 'intake',
    "priority" "public"."case_priority" NOT NULL DEFAULT 'normal',
    "current_node_key" VARCHAR(100),
    "current_task_id" INTEGER,
    "assignee_user_id" INTEGER,
    "assignee_team_id" INTEGER,
    "intake_source" VARCHAR,
    "case_data_json" JSONB,
    "flow_snapshot_json" JSONB NOT NULL,
    "outcome_json" JSONB,
    "opened_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "created_by_user_id" INTEGER,

    CONSTRAINT "cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."case_tasks" (
    "id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "flow_node_key" VARCHAR(100) NOT NULL,
    "task_type" "public"."case_task_type" NOT NULL,
    "title" VARCHAR NOT NULL,
    "status" "public"."case_task_status" NOT NULL DEFAULT 'pending',
    "assigned_user_id" INTEGER,
    "assigned_team_id" INTEGER,
    "claim_policy" "public"."claim_policy" NOT NULL DEFAULT 'claim_required',
    "claimed_at" TIMESTAMPTZ(6),
    "due_at" TIMESTAMPTZ(6),
    "completed_at" TIMESTAMPTZ(6),
    "decision" VARCHAR,
    "input_json" JSONB,
    "output_json" JSONB,
    "completed_by_user_id" INTEGER,

    CONSTRAINT "case_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."case_events" (
    "id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "flow_node_key" VARCHAR(100),
    "task_id" INTEGER,
    "actor_user_id" INTEGER,
    "event_type" "public"."case_event_type" NOT NULL,
    "summary" VARCHAR,
    "data_json" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."case_approvals" (
    "id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "task_id" INTEGER,
    "flow_node_key" VARCHAR(100) NOT NULL,
    "approval_label" VARCHAR NOT NULL,
    "status" "public"."case_approval_status" NOT NULL DEFAULT 'requested',
    "requested_from_user_id" INTEGER,
    "requested_from_role_id" INTEGER,
    "requested_from_team_id" INTEGER,
    "requested_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "due_at" TIMESTAMPTZ(6),
    "decided_at" TIMESTAMPTZ(6),
    "decided_by_user_id" INTEGER,
    "required_comment" BOOLEAN NOT NULL DEFAULT false,
    "decision_reason" VARCHAR,

    CONSTRAINT "case_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."case_escalations" (
    "id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "source_task_id" INTEGER,
    "flow_node_key" VARCHAR(100),
    "escalation_type" VARCHAR NOT NULL,
    "status" "public"."case_escalation_status" NOT NULL DEFAULT 'triggered',
    "reason" VARCHAR NOT NULL,
    "from_user_id" INTEGER,
    "to_user_id" INTEGER,
    "to_team_id" INTEGER,
    "triggered_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMPTZ(6),
    "resolved_by_user_id" INTEGER,

    CONSTRAINT "case_escalations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."case_documents" (
    "id" SERIAL NOT NULL,
    "case_id" INTEGER NOT NULL,
    "task_id" INTEGER,
    "flow_node_key" VARCHAR(100),
    "filename" VARCHAR NOT NULL,
    "mime_type" VARCHAR NOT NULL,
    "storage_path" VARCHAR NOT NULL,
    "document_type" VARCHAR,
    "metadata_json" JSONB,
    "uploaded_by_user_id" INTEGER,
    "uploaded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "case_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "idx_audit_actor" ON "public"."audit_logs"("actor_user_id");

-- CreateIndex
CREATE INDEX "idx_audit_entity" ON "public"."audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "public"."roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "idx_users_role_id" ON "public"."users"("role_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_key_key" ON "public"."teams"("key");

-- CreateIndex
CREATE INDEX "idx_team_memberships_user" ON "public"."team_memberships"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "uq_team_memberships_team_user" ON "public"."team_memberships"("team_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "case_flows_key_key" ON "public"."case_flows"("key");

-- CreateIndex
CREATE UNIQUE INDEX "case_flows_current_published_version_id_key" ON "public"."case_flows"("current_published_version_id");

-- CreateIndex
CREATE INDEX "idx_case_flows_archived" ON "public"."case_flows"("archived_at");

-- CreateIndex
CREATE INDEX "idx_case_flows_owner" ON "public"."case_flows"("owner_user_id");

-- CreateIndex
CREATE INDEX "idx_case_flows_status" ON "public"."case_flows"("status");

-- CreateIndex
CREATE INDEX "idx_case_flow_draft_nodes_flow" ON "public"."case_flow_draft_nodes"("case_flow_id");

-- CreateIndex
CREATE INDEX "idx_case_flow_draft_nodes_kind" ON "public"."case_flow_draft_nodes"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "uq_case_flow_draft_nodes_flow_node_key" ON "public"."case_flow_draft_nodes"("case_flow_id", "node_key");

-- CreateIndex
CREATE INDEX "idx_case_flow_draft_edges_from" ON "public"."case_flow_draft_edges"("case_flow_id", "from_node_key");

-- CreateIndex
CREATE INDEX "idx_case_flow_draft_edges_to" ON "public"."case_flow_draft_edges"("case_flow_id", "to_node_key");

-- CreateIndex
CREATE UNIQUE INDEX "uq_case_flow_draft_edges_flow_edge_key" ON "public"."case_flow_draft_edges"("case_flow_id", "edge_key");

-- CreateIndex
CREATE INDEX "idx_case_flow_versions_published_by" ON "public"."case_flow_versions"("published_by_user_id");

-- CreateIndex
CREATE INDEX "idx_case_flow_versions_status" ON "public"."case_flow_versions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "uq_case_flow_versions_flow_version" ON "public"."case_flow_versions"("case_flow_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "cases_case_reference_key" ON "public"."cases"("case_reference");

-- CreateIndex
CREATE INDEX "idx_cases_assignee_team" ON "public"."cases"("assignee_team_id");

-- CreateIndex
CREATE INDEX "idx_cases_assignee_user" ON "public"."cases"("assignee_user_id");

-- CreateIndex
CREATE INDEX "idx_cases_flow" ON "public"."cases"("case_flow_id");

-- CreateIndex
CREATE INDEX "idx_cases_flow_version" ON "public"."cases"("case_flow_version_id");

-- CreateIndex
CREATE INDEX "idx_cases_current_node_key" ON "public"."cases"("current_node_key");

-- CreateIndex
CREATE INDEX "idx_cases_status" ON "public"."cases"("status");

-- CreateIndex
CREATE INDEX "idx_case_tasks_assigned_team" ON "public"."case_tasks"("assigned_team_id");

-- CreateIndex
CREATE INDEX "idx_case_tasks_assigned_user" ON "public"."case_tasks"("assigned_user_id");

-- CreateIndex
CREATE INDEX "idx_case_tasks_case" ON "public"."case_tasks"("case_id");

-- CreateIndex
CREATE INDEX "idx_case_tasks_due_at" ON "public"."case_tasks"("due_at");

-- CreateIndex
CREATE INDEX "idx_case_tasks_status" ON "public"."case_tasks"("status");

-- CreateIndex
CREATE INDEX "idx_case_events_actor" ON "public"."case_events"("actor_user_id");

-- CreateIndex
CREATE INDEX "idx_case_events_case" ON "public"."case_events"("case_id");

-- CreateIndex
CREATE INDEX "idx_case_events_type" ON "public"."case_events"("event_type");

-- CreateIndex
CREATE INDEX "idx_case_events_task" ON "public"."case_events"("task_id");

-- CreateIndex
CREATE INDEX "idx_case_approvals_case" ON "public"."case_approvals"("case_id");

-- CreateIndex
CREATE INDEX "idx_case_approvals_role" ON "public"."case_approvals"("requested_from_role_id");

-- CreateIndex
CREATE INDEX "idx_case_approvals_team" ON "public"."case_approvals"("requested_from_team_id");

-- CreateIndex
CREATE INDEX "idx_case_approvals_user" ON "public"."case_approvals"("requested_from_user_id");

-- CreateIndex
CREATE INDEX "idx_case_approvals_status" ON "public"."case_approvals"("status");

-- CreateIndex
CREATE INDEX "idx_case_approvals_task" ON "public"."case_approvals"("task_id");

-- CreateIndex
CREATE INDEX "idx_case_escalations_case" ON "public"."case_escalations"("case_id");

-- CreateIndex
CREATE INDEX "idx_case_escalations_source_task" ON "public"."case_escalations"("source_task_id");

-- CreateIndex
CREATE INDEX "idx_case_escalations_status" ON "public"."case_escalations"("status");

-- CreateIndex
CREATE INDEX "idx_case_escalations_team" ON "public"."case_escalations"("to_team_id");

-- CreateIndex
CREATE INDEX "idx_case_escalations_user" ON "public"."case_escalations"("to_user_id");

-- CreateIndex
CREATE INDEX "idx_case_documents_case" ON "public"."case_documents"("case_id");

-- CreateIndex
CREATE INDEX "idx_case_documents_task" ON "public"."case_documents"("task_id");

-- CreateIndex
CREATE INDEX "idx_case_documents_uploaded_by" ON "public"."case_documents"("uploaded_by_user_id");

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."team_memberships" ADD CONSTRAINT "team_memberships_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "public"."teams"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."team_memberships" ADD CONSTRAINT "team_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_flows" ADD CONSTRAINT "case_flows_current_published_version_id_fkey" FOREIGN KEY ("current_published_version_id") REFERENCES "public"."case_flow_versions"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_flows" ADD CONSTRAINT "case_flows_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_flow_draft_nodes" ADD CONSTRAINT "case_flow_draft_nodes_case_flow_id_fkey" FOREIGN KEY ("case_flow_id") REFERENCES "public"."case_flows"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_flow_draft_edges" ADD CONSTRAINT "case_flow_draft_edges_case_flow_id_fkey" FOREIGN KEY ("case_flow_id") REFERENCES "public"."case_flows"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_flow_versions" ADD CONSTRAINT "case_flow_versions_case_flow_id_fkey" FOREIGN KEY ("case_flow_id") REFERENCES "public"."case_flows"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_flow_versions" ADD CONSTRAINT "case_flow_versions_published_by_user_id_fkey" FOREIGN KEY ("published_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cases" ADD CONSTRAINT "cases_assignee_team_id_fkey" FOREIGN KEY ("assignee_team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cases" ADD CONSTRAINT "cases_assignee_user_id_fkey" FOREIGN KEY ("assignee_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cases" ADD CONSTRAINT "cases_case_flow_version_id_fkey" FOREIGN KEY ("case_flow_version_id") REFERENCES "public"."case_flow_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cases" ADD CONSTRAINT "cases_case_flow_id_fkey" FOREIGN KEY ("case_flow_id") REFERENCES "public"."case_flows"("id") ON DELETE RESTRICT ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."cases" ADD CONSTRAINT "cases_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_tasks" ADD CONSTRAINT "case_tasks_assigned_team_id_fkey" FOREIGN KEY ("assigned_team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_tasks" ADD CONSTRAINT "case_tasks_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_tasks" ADD CONSTRAINT "case_tasks_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_tasks" ADD CONSTRAINT "case_tasks_completed_by_user_id_fkey" FOREIGN KEY ("completed_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_events" ADD CONSTRAINT "case_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_events" ADD CONSTRAINT "case_events_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."case_tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_events" ADD CONSTRAINT "case_events_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_approvals" ADD CONSTRAINT "case_approvals_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_approvals" ADD CONSTRAINT "case_approvals_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."case_tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_approvals" ADD CONSTRAINT "case_approvals_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_approvals" ADD CONSTRAINT "case_approvals_requested_from_role_id_fkey" FOREIGN KEY ("requested_from_role_id") REFERENCES "public"."roles"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_approvals" ADD CONSTRAINT "case_approvals_requested_from_team_id_fkey" FOREIGN KEY ("requested_from_team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_approvals" ADD CONSTRAINT "case_approvals_requested_from_user_id_fkey" FOREIGN KEY ("requested_from_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_escalations" ADD CONSTRAINT "case_escalations_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_escalations" ADD CONSTRAINT "case_escalations_from_user_id_fkey" FOREIGN KEY ("from_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_escalations" ADD CONSTRAINT "case_escalations_resolved_by_user_id_fkey" FOREIGN KEY ("resolved_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_escalations" ADD CONSTRAINT "case_escalations_source_task_id_fkey" FOREIGN KEY ("source_task_id") REFERENCES "public"."case_tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_escalations" ADD CONSTRAINT "case_escalations_to_team_id_fkey" FOREIGN KEY ("to_team_id") REFERENCES "public"."teams"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_escalations" ADD CONSTRAINT "case_escalations_to_user_id_fkey" FOREIGN KEY ("to_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_documents" ADD CONSTRAINT "case_documents_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "public"."case_tasks"("id") ON DELETE SET NULL ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_documents" ADD CONSTRAINT "case_documents_case_id_fkey" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE CASCADE ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "public"."case_documents" ADD CONSTRAINT "case_documents_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE NO ACTION;
