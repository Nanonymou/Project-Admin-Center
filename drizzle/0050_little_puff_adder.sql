CREATE VIEW "public"."sales_change_history" AS (
    select "id", "project_id", "location_id", "transaction_id", "trx_date", "category_key",
      "action", "field", "before_value", "after_value", "editor", "reason", "created_at"
    from "entry_change_history"
    where "kind" = 'sales'
  );