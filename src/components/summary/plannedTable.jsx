import React from 'react';
import './summary.css'; // Assuming shared styles

function PlannedTable({ data, showPercent = true }) {
  if (!data || data.length === 0) {
    return <p>Loading or no planned stock.</p>;
  }
  
  // Find indices of gap rows
  const gapIndices = data
    .map((item, idx) => item.isGap ? idx : null)
    .filter(idx => idx !== null);

  // Helper to sum a field for a section
  const sumSection = (start, end, field, subfield) =>
    data.slice(start, end).reduce((sum, item) =>
      (!item.isGap && item.sleeveType !== 'base'
        ? sum + (subfield ? (item[field]?.[subfield] || 0) : (item[field] || 0))
        : sum), 0
    );

  return (
    <table className="stockTable plannedTable">
      <thead>
        <tr>
          <th></th>
          <th title='Current Stock'>Stock</th>
          <th colSpan={3} title='Quantity currently on order'>Planned</th>
          <th title=''>Aim</th>
        </tr>
        <tr>
          <th></th>
          <th></th>
          <th title='1 Week Planned Stock Ratio'>
            <span className="th-full">1 Week</span>
            <span className="th-short">1wk</span>
          </th>
          <th title='2 Weeks Planned Stock Ratio'>
            <span className="th-full">2 Weeks</span>
            <span className="th-short">2wks</span>
          </th>
          <th title='3 Weeks Planned Stock Ratio'>
            <span className="th-full">3 Weeks</span>
            <span className="th-short"><strong>>></strong></span>
          </th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {data.map((item, i) => {
          // Subtotal row
          if (item.isGap) {
            const prevGapIdx = gapIndices.filter(idx => idx < i).pop() ?? -1;
            const subtotalStock = sumSection(prevGapIdx + 1, i, 'total');
            const subtotalW1 = sumSection(prevGapIdx + 1, i, 'stockNumbers', 'w1');
            const subtotalW2 = sumSection(prevGapIdx + 1, i, 'stockNumbers', 'w2');
            const subtotalW3 = sumSection(prevGapIdx + 1, i, 'stockNumbers', 'w3');

            return (
              <React.Fragment key={`subtotal-gap-${i}`}>
                <tr className="subtotal-row">
                  <td><strong>Subtotal</strong></td>
                  <td><strong>{subtotalStock}</strong></td>
                  <td><strong>{subtotalW1}</strong></td>
                  <td><strong>{subtotalW2}</strong></td>
                  <td><strong>{subtotalW3}</strong></td>
                  <td></td>
                </tr>
                <tr key={`gap-${i}`} className="sleeve-gap-row">
                  <td className="sleeve-gap-row"></td>
                </tr>
              </React.Fragment>
            );
          }
          return (
            <tr key={i} style={{ backgroundColor: `${item.color}30` }}>
              <td className="pizza-id-cell">
                <span className="pizzaBadge" title={item.name} style={{ backgroundColor: `${item.color}70`}}>
                  {item.name}
                </span>
              </td>
              <td>
                {(item.sleeveType === 'base' || item.id === 'DOU_A0' || item.id === 'DOU_A1')
                  ? item.total
                  : (showPercent && item.ratio != null
                      ? `${item.ratio}%`
                      : item.total)}
              </td>
              <td>
                {(item.sleeveType === 'base' || item.id === 'DOU_A0' || item.id === 'DOU_A1')
                  ? (item.stockNumbers?.w1 ?? 0)
                  : (showPercent
                      ? (item.ratios?.w1 ?? '') + '%'
                      : (item.stockNumbers?.w1 ?? 0))}
              </td>
              <td>
                {(item.sleeveType === 'base' || item.id === 'DOU_A0' || item.id === 'DOU_A1')
                  ? (item.stockNumbers?.w2 ?? 0)
                  : (showPercent
                      ? (item.ratios?.w2 ?? '') + '%'
                      : (item.stockNumbers?.w2 ?? 0))}
              </td>
              <td>
                {(item.sleeveType === 'base' || item.id === 'DOU_A0' || item.id === 'DOU_A1')
                  ? (item.stockNumbers?.w3 ?? 0)
                  : (showPercent
                      ? (item.ratios?.w3 ?? '') + '%'
                      : (item.stockNumbers?.w3 ?? 0))}
              </td>
              <td
                className={
                  item.goal == null ? '' : item.meetsGoal ? 'ok' : 'warn'
                }
              >
                {item.goal != null ? `${item.goal}%` : ''}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default PlannedTable;