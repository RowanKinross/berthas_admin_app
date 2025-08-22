import React, { useState } from "react";
import './summary.css';

function OrderingHabitsTable({ pizzas, orders, summaryOrder, averageOrdering, showPercent = true }) {

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
  const sleeveAvgTotals = { '0': 0, '1': 0 };
  summaryOrder.forEach(item => {
  if (item.sleeveType === '0' || item.sleeveType === '1') {
    sleeveAvgTotals[item.sleeveType] += averageOrdering[item.id] || 0;
  }
});


  // Find indices of gap rows
  const gapIndices = summaryOrder
    .map((item, idx) => item.isGap ? idx : null)
    .filter(idx => idx !== null);

  // Helper to sum a field for a section
  const sumSection = (start, end, field) =>
    summaryOrder.slice(start, end).reduce((sum, item) =>
      (!item.isGap && (item.sleeveType === '0' || item.sleeveType === '1')
        ? sum + (field === 'lastWeek'
            ? pizzaStats[item.id].lastWeek
            : averageOrdering[item.id] || 0)
        : sum), 0
    );

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
          {summaryOrder.map((item, i) => {
            // Subtotal row
            if (item.isGap) {
              const prevGapIdx = gapIndices.filter(idx => idx < i).pop() ?? -1;
              const subtotalLastWeek = sumSection(prevGapIdx + 1, i, 'lastWeek');
              const subtotal4Week = summaryOrder
                .slice(prevGapIdx + 1, i)
                .reduce((sum, item) =>
                  (!item.isGap && (item.sleeveType === '0' || item.sleeveType === '1')
                    ? sum + (averageOrdering[item.id] || 0)
                    : sum), 0
                );

              return (
                <React.Fragment key={`subtotal-gap-${i}`}>
                  <tr className="subtotalRow">
                    <td><strong>Subtotal</strong></td>
                    <td><strong>{subtotalLastWeek}</strong></td>
                    <td><strong>{subtotal4Week}</strong></td>
                  </tr>
                  <tr key={`gap-${i}`} className="gap-row">
                    <td colSpan={3} className="gap"></td>
                  </tr>
                </React.Fragment>
              );
            }
            return (
              <tr key={item.id} style={{ backgroundColor: `${item.color}30` }}>
                <td className="pizza-id-cell" >
                  <span className="pizzaBadge" title={item.name} style={{ backgroundColor: `${item.color}70`}}>
                    {item.name}
                  </span>
                </td>
                <td>
                  {(item.sleeveType === 'base' || item.id === 'DOU_A0' || item.id === 'DOU_A1')
                    ? pizzaStats[item.id].lastWeek
                    : (showPercent && (item.sleeveType === '0' || item.sleeveType === '1')
                        ? (sleeveTotals[item.sleeveType]
                            ? Math.round((pizzaStats[item.id].lastWeek / sleeveTotals[item.sleeveType]) * 100) + '%'
                            : '0%')
                        : pizzaStats[item.id].lastWeek)}
                </td>
                <td>
                  {(item.sleeveType === 'base' || item.id === 'DOU_A0' || item.id === 'DOU_A1')
                    ? (averageOrdering[item.id] || 0)
                    : (showPercent && (item.sleeveType === '0' || item.sleeveType === '1')
                        ? (
                            sleeveAvgTotals[item.sleeveType]
                              ? (
                                  isNaN(averageOrdering[item.id] / sleeveAvgTotals[item.sleeveType])
                                    ? '0%'
                                    : Math.round((averageOrdering[item.id] / sleeveAvgTotals[item.sleeveType]) * 100) + '%'
                                )
                              : '0%'
                          )
                        : (averageOrdering[item.id] || 0))}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default OrderingHabitsTable;
