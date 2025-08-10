import React from 'react';
import './summary.css'; // Assuming shared styles

function PlannedTable({ data }) {
  if (!data || data.length === 0) {
    return <p>Loading or no planned stock.</p>;
  }

  return (
    <table className="stock-table planned-table">
      <thead>
        <tr>
          <th></th>
          <th>Current</th>
          <th>1 Week</th>
          <th>2 Weeks</th>
          <th>3 Weeks</th>
          <th>Goal</th>
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
                {/* {item.id} */}
              </td>
              <td>{item.ratios?.current ?? ''}%</td>
              <td>{item.ratios?.w1 ?? ''}%</td>
              <td>{item.ratios?.w2 ?? ''}%</td>
              <td>{item.ratios?.w3 ?? ''}%</td>
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