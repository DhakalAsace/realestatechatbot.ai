create policy "workspace creators can read bootstrap workspaces" on public.workspaces
for select to authenticated
using (created_by = (select auth.uid()));
