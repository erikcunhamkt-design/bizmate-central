
ALTER TABLE public.products ADD COLUMN foto_url text DEFAULT NULL;

INSERT INTO storage.buckets (id, name, public) VALUES ('product-photos', 'product-photos', true);

CREATE POLICY "Users can upload product photos" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-photos');
CREATE POLICY "Users can update own product photos" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'product-photos');
CREATE POLICY "Users can delete own product photos" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'product-photos');
CREATE POLICY "Public can view product photos" ON storage.objects FOR SELECT TO public USING (bucket_id = 'product-photos');
