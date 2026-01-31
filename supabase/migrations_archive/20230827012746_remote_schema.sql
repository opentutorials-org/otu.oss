drop policy "Enable delete for users based on user_id" on "public"."topics";

drop policy "Enable insert for authenticated users only" on "public"."topics";

drop policy "Enable read access for all users" on "public"."topics";

drop policy "Enable update for users based on email" on "public"."topics";

alter table "public"."edge" drop constraint "edge_child_node_id_fkey";

alter table "public"."edge" drop constraint "edge_parent_node_id_fkey";

alter table "public"."topics" drop constraint "topics_user_id_fkey";

alter table "public"."edge" drop constraint "edge_pkey";

alter table "public"."node" drop constraint "node_pkey";

alter table "public"."topics" drop constraint "topics_pkey";

drop index if exists "public"."edge_pkey";

drop index if exists "public"."node_pkey";

drop index if exists "public"."topics_pkey";

drop table "public"."edge";

drop table "public"."node";

drop table "public"."topics";


