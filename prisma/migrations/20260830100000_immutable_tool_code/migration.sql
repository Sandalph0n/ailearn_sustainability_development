-- `code` là định danh giao thức và subpath `/tools/<code>`, không phải nhãn hiển thị.
CREATE OR REPLACE FUNCTION "preventToolCodeChange"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF NEW.code IS DISTINCT FROM OLD.code THEN
        RAISE EXCEPTION 'Tool code cannot change after creation';
    END IF;
    RETURN NEW;
END;
$$;

CREATE TRIGGER "Tool_immutable_code_trigger"
BEFORE UPDATE OF code ON "Tool"
FOR EACH ROW
EXECUTE FUNCTION "preventToolCodeChange"();
