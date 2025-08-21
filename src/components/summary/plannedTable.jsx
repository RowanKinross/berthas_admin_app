import React from 'react';
import './summary.css'; // Assuming shared styles

function PlannedTable({ data, showPercent = true }) {
  if (!data || data.length === 0) {
    return <p>Loading or no planned stock.</p>;
  }

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
            <span className="th-short">3wks</span>
          </th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {data.map((item, i) => {
          if (item.isGap) {
            return (
              <tr key={`gap-${i}`} className="sleeve-gap-row">
                <td className="sleeve-gap-row"></td>
              </tr>
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
                {showPercent
                  ? (item.ratios?.current ?? '') + '%'
                  : (item.stockNumbers?.current ?? '')}
              </td>
              <td>
                {showPercent
                  ? (item.ratios?.w1 ?? '') + '%'
                  : (item.stockNumbers?.w1 ?? 0)}
              </td>
              <td>
                {showPercent
                  ? (item.ratios?.w2 ?? '') + '%'
                  : (item.stockNumbers?.w2 ?? 0)}
              </td>
              <td>
                {showPercent
                  ? (item.ratios?.w3 ?? '') + '%'
                  : (item.stockNumbers?.w3 ?? 0)}
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