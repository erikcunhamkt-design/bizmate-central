
-- Create storage bucket for customer photos
INSERT INTO storage.buckets (id, name, public) VALUES ('customer-photos', 'customer-photos', true);

-- Allow authenticated users to upload files
CREATE POLICY "Users can upload customer photos"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'customer-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to update their own files
CREATE POLICY "Users can update own customer photos"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'customer-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own customer photos"
ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'customer-photos' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Allow public read access since bucket is public
CREATE POLICY "Public read access for customer photos"
ON storage.objects FOR SELECT TO public
USING (bucket_id = 'customer-photos');
