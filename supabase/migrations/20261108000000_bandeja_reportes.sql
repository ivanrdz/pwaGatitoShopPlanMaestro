-- Bandeja de reportes automáticos.
-- n8n sube los PDF de los cortes a bandeja/<user_id>/<archivo>.pdf con la llave service_role
-- (que vive solo en n8n). La app de cada usuario solo puede ver y borrar su propia carpeta.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bandeja', 'bandeja', false, 10485760, array['application/pdf'])
on conflict (id) do nothing;

create policy "bandeja: ver lo propio"
  on storage.objects for select to authenticated
  using (bucket_id = 'bandeja' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "bandeja: borrar lo propio"
  on storage.objects for delete to authenticated
  using (bucket_id = 'bandeja' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Permite subir a mano desde la app o probar con tu propia sesión; n8n usa service_role.
create policy "bandeja: subir a lo propio"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'bandeja' and (storage.foldername(name))[1] = (select auth.uid())::text);
