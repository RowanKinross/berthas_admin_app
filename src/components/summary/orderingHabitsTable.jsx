import React, { useState } from "react";
import './summary.css';

function OrderingHabitsTable({ pizzas, orders, summaryOrder, showPercent = true }) {

  // Helper: get Monday of this week
  const getMonday = (d) => {
    const date = new Date(d);
    const day = date.getDay() || 7;
    if (day !== 1) date.setDate(date.getDate() - (day - 1));
    date.setHours(0,0,0,0);
    return date;
  };

  // Calculate week ranges
  const now = new Date();
  const thisMonday = getMonday(now);
  const lastMonday = new Date(thisMonday); lastMonday.setDate(thisMonday.getDate() - 7);
  const fourWeeksAgo = new Date(thisMonday); fourWeeksAgo.setDate(thisMonday.getDate() - 28);

  // Build pizzaId -> { lastWeek, avg4Weeks } map
  const pizzaStats = {};
  summaryOrder.forEach(item => {
    pizzaStats[item.id] = { lastWeek: 0, fourWeekTotal: 0 };
  });

  orders.forEach(order => {
    if (!order.delivery_day || order.delivery_day === "tbc") return;
    const delivery = new Date(order.delivery_day);
    Object.entries(order.pizzas || {}).forEach(([pizzaId, pizzaData]) => {
      if (!pizzaStats[pizzaId]) return;
      if (delivery >= lastMonday && delivery < thisMonday) {
        pizzaStats[pizzaId].lastWeek += pizzaData.quantity || 0;
      }
      if (delivery >= fourWeeksAgo && delivery < thisMonday) {
        pizzaStats[pizzaId].fourWeekTotal += pizzaData.quantity || 0;
      }
    });
  });

  // Calculate sleeve totals for percent
  const sleeveTotals = { '0': 0, '1': 0 };
  summaryOrder.forEach(item => {
    if (item.sleeveType === '0' || item.sleeveType === '1') {
      sleeveTotals[item.sleeveType] += pizzaStats[item.id].lastWeek;
    }
  });

  return (
    <div>
      <table className="stockTable">
        <thead>
          <tr>
            <th></th>
            <th>Last Week</th>
            <th>4-Week Avg</th>
          </tr>
        </thead>
        <tbody>
          {summaryOrder.map(item =>
            item.isGap ? (
              <tr key={Math.random()}><td colSpan={3} className="gap"></td></tr>
            ) : (
              <tr key={item.id} style={{ backgroundColor: `${item.color}30` }}>
                <td className="pizza-id-cell" >
                  <span className="pizzaBadge" title={item.name} style={{ backgroundColor: `${item.color}70`}}>
                    {item.name}
                  </span>
                </td>
                <td>
                  {showPercent && (item.sleeveType === '0' || item.sleeveType === '1')
                    ? sleeveTotals[item.sleeveType]
                      ? Math.round((pizzaStats[item.id].lastWeek / sleeveTotals[item.sleeveType]) * 100) + '%'
                      : '0%'
                    : pizzaStats[item.id].lastWeek}
                </td>
                <td>
                  {showPercent && (item.sleeveType === '0' || item.sleeveType === '1')
                    ? sleeveTotals[item.sleeveType]
                      ? Math.round(((pizzaStats[item.id].fourWeekTotal / 4) / sleeveTotals[item.sleeveType]) * 100) + '%'
                      : '0%'
                    : Math.round(pizzaStats[item.id].fourWeekTotal / 4)}
                </td>
              </tr>
            )
          )}
        </tbody>
      </table>
    </div>
  );
}

export default OrderingHabitsTable;
