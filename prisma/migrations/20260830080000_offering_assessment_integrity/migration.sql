-- Kiểm dữ liệu cũ trước khi thêm constraint để migration không che một bản ghi sai.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM "Assessment"
        WHERE weight <= 0
           OR weight > 100
           OR ("publishAt" IS NOT NULL AND "publishAt" >= "dueAt")
    ) THEN
        RAISE EXCEPTION 'Cannot add Assessment constraints: invalid rows exist';
    END IF;
END
$$;

ALTER TABLE "Assessment"
ADD CONSTRAINT "Assessment_weight_range_check" CHECK (weight > 0 AND weight <= 100),
ADD CONSTRAINT "Assessment_publish_before_due_check"
CHECK ("publishAt" IS NULL OR "publishAt" < "dueAt");

-- RoleAssignment là lịch sử phân quyền; xoá offering không được âm thầm xoá lịch sử này.
ALTER TABLE "RoleAssignment"
DROP CONSTRAINT "RoleAssignment_offeringId_fkey";

ALTER TABLE "RoleAssignment"
ADD CONSTRAINT "RoleAssignment_offeringId_fkey"
FOREIGN KEY ("offeringId") REFERENCES "Offering"(id)
ON DELETE RESTRICT ON UPDATE CASCADE;

-- Nhiều request cùng thêm assessment phải cùng khoá theo offering; nếu chỉ kiểm trong API,
-- hai transaction đều có thể đọc tổng cũ rồi cùng đẩy tổng vượt 100.
CREATE OR REPLACE FUNCTION "validateAssessmentWeightBudget"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
    lock_key bigint;
    existing_total double precision;
BEGIN
    IF TG_OP = 'UPDATE' THEN
        FOR lock_key IN
            SELECT DISTINCT value
            FROM (
                VALUES
                    (hashtextextended('assessment-weight:' || OLD."offeringId"::text, 0)),
                    (hashtextextended('assessment-weight:' || NEW."offeringId"::text, 0))
            ) AS keys(value)
            ORDER BY value
        LOOP
            PERFORM pg_advisory_xact_lock(lock_key);
        END LOOP;
    ELSE
        PERFORM pg_advisory_xact_lock(
            hashtextextended('assessment-weight:' || NEW."offeringId"::text, 0)
        );
    END IF;

    SELECT COALESCE(SUM(weight), 0)
    INTO existing_total
    FROM "Assessment"
    WHERE "offeringId" = NEW."offeringId"
      AND id <> NEW.id;

    IF existing_total + NEW.weight > 100 + 1e-9 THEN
        RAISE EXCEPTION 'Assessment weights for an offering cannot exceed 100%%';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "Assessment_weight_budget_trigger"
BEFORE INSERT OR UPDATE OF weight, "offeringId" ON "Assessment"
FOR EACH ROW
EXECUTE FUNCTION "validateAssessmentWeightBudget"();

-- Đổi subject/term sau khi offering có nội dung sẽ đổi ý nghĩa của toàn bộ lịch sử bên dưới.
CREATE OR REPLACE FUNCTION "preventLinkedOfferingMove"()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    IF (NEW."subjectId", NEW."termId") IS DISTINCT FROM (OLD."subjectId", OLD."termId")
       AND (
           EXISTS (SELECT 1 FROM "Assessment" WHERE "offeringId" = OLD.id)
           OR EXISTS (SELECT 1 FROM "RoleAssignment" WHERE "offeringId" = OLD.id)
       )
    THEN
        RAISE EXCEPTION 'An offering with assessments or assignment history cannot move';
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER "Offering_prevent_linked_move_trigger"
BEFORE UPDATE OF "subjectId", "termId" ON "Offering"
FOR EACH ROW
EXECUTE FUNCTION "preventLinkedOfferingMove"();
