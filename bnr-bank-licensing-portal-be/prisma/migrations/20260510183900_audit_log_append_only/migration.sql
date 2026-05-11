CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'AuditLog is append-only and cannot be modified or deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
BEFORE UPDATE ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER audit_log_no_delete
BEFORE DELETE ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();
