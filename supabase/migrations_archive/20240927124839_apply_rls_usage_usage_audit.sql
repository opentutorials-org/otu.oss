drop policy "Allow service role to insert" on "public"."usage";

create policy "Enable insert for users based on user_id"
on "public"."usage"
as permissive
for insert
to public
with check ((( SELECT auth.uid() AS uid) = user_id));


create policy "Enable insert for users based on user_id"
on "public"."usage_audit"
as permissive
for insert
to public
with check ((( SELECT auth.uid() AS uid) = user_id));



