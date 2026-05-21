const Database = require('better-sqlite3');
const db = new Database('./data/maxaria.db', { readonly: true });

const rows = db.prepare(
  "WITH order_vendedor AS (" +
  "  SELECT DISTINCT v.id AS vendedor_id, o.id AS order_id, o.status, o.total" +
  "    FROM users v" +
  "    JOIN orders o ON (o.assigned_vendedor_id = v.id OR" +
  "                      o.user_id IN (SELECT id FROM users WHERE assigned_vendedor_id = v.id))" +
  "   WHERE v.level = 5 AND o.status != 'cancelado'" +
  ")," +
  "order_agg AS (" +
  "  SELECT vendedor_id," +
  "         COUNT(*) AS total_orders," +
  "         SUM(CASE WHEN status = 'entregado' THEN 1 ELSE 0 END) AS total_delivered," +
  "         SUM(total) AS total_sold" +
  "    FROM order_vendedor GROUP BY vendedor_id" +
  ")," +
  "item_agg AS (" +
  "  SELECT ov.vendedor_id," +
  "         SUM(CASE WHEN oi.vendedor_cost_unit IS NOT NULL" +
  "                  THEN oi.vendedor_cost_unit * oi.quantity ELSE 0 END) AS total_cost," +
  "         SUM(CASE WHEN oi.vendedor_cost_unit IS NOT NULL" +
  "                  THEN (oi.unit_price - oi.vendedor_cost_unit) * oi.quantity ELSE 0 END) AS total_earning" +
  "    FROM order_vendedor ov" +
  "    JOIN order_items oi ON oi.order_id = ov.order_id" +
  "   GROUP BY ov.vendedor_id" +
  ") " +
  "SELECT v.id AS vendedor_id, v.username, v.full_name, v.active, v.is_tercerizado," +
  "       COALESCE(oa.total_orders, 0) AS total_orders," +
  "       COALESCE(oa.total_delivered, 0) AS total_delivered," +
  "       COALESCE(oa.total_sold, 0) AS total_sold," +
  "       COALESCE(ia.total_cost, 0) AS total_cost," +
  "       COALESCE(ia.total_earning, 0) AS total_earning" +
  "  FROM users v" +
  "  LEFT JOIN order_agg oa ON oa.vendedor_id = v.id" +
  "  LEFT JOIN item_agg ia ON ia.vendedor_id = v.id" +
  " WHERE v.level = 5" +
  " ORDER BY total_earning DESC, v.username"
).all();
console.log(JSON.stringify(rows, null, 2));
