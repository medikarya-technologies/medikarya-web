-- MAIN project (srsqsl…). The chest pain case's public description had an em dash ("Every minute counts — work him
-- up"), which the site's copy rules do not allow. The bundled copy (data/cases/simulation/acute-anterior-stemi.json)
-- is already fixed; this fixes the database row the site actually reads. Safe to run twice: it only touches a
-- description that still has the dash, and leaves updated_at alone (the case list is ordered by it). The case may still
-- be stored under its old id, so both are matched.
update cases
set case_json = jsonb_set(
      case_json,
      '{displayDescription}',
      to_jsonb('A middle-aged man arrives in the emergency department clutching his chest, grey and sweating. Every minute counts. Work him up, act on what you find, and decide before he decides for you.'::text)
    )
where id in ('61-year-old-man-with-severe-chest-pain-and-sweating', 'acute-anterior-stemi')
  and case_json->>'displayDescription' like '%—%';

-- Any other published case whose public description still has an em or en dash (expect no rows):
select id, case_json->>'displayDescription' as description
from cases
where status = 'published'
  and (case_json->>'displayDescription' like '%—%' or case_json->>'displayDescription' like '%–%');
