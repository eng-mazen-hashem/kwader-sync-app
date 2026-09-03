-- First verify if a delete policy exists.
DROP POLICY IF EXISTS "Company owners can delete their notifications" ON company_notifications;
DROP POLICY IF EXISTS "Companies can delete notifications" ON company_notifications;

-- Create DELETE policy for company_notifications
CREATE POLICY "Company owners can delete their notifications" 
ON company_notifications FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM companies c 
    WHERE c.id = company_notifications.company_id AND c.owner_id = auth.uid()
  )
);
