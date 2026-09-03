-- Approved and rejected requests are audit records. Once processed, neither their result nor the
-- link that proves REQUEST_APPROVED provenance may be edited or deleted.

CREATE FUNCTION "prevent_processed_scope_request_change"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    IF OLD."status" <> 'PENDING' THEN
        RAISE EXCEPTION 'A processed scope assignment request is immutable'
            USING ERRCODE = '23514';
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "ScopeAssignmentRequest_immutable_history_trigger"
BEFORE UPDATE OR DELETE ON "ScopeAssignmentRequest"
FOR EACH ROW EXECUTE FUNCTION "prevent_processed_scope_request_change"();
