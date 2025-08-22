import React from 'react';

function StockTable({ data, showPercent = true, sleeveDenoms, sleeveOnOrderTotals }) {
  if (!data || data.length === 0) {
    return <p>Loading stock...</p>;
  }

  const getShortStatus = (status) => {
  switch (status) {
    case "Short - Urgent!": return "Short";
    case "Low": return "Low";
    case "Available": return "Avail";
    case "Overstocked": return "Over";
    default: return status;
  }
};

// Find indices of gap rows
const gapIndices = data
  .map((item, idx) => item.isGap ? idx : null)
  .filter(idx => idx !== null);

// Helper to sum a field for a section
const sumSection = (start, end, field) =>
  data.slice(start, end).reduce((sum, item) =>
    (item.sleeveType !== 'base' && !item.isGap ? sum + (item[field] || 0) : sum), 0
  );

  return (
    <table className="stockTable">
      <thead>
        <tr>
          <th></th>
          <th title='Current Stock'>Stock</th>
          <th colSpan={3} title='Quantity currently on order'>Ordered</th>
          <th title=''>Status</th>
        </tr>
        <tr>
          <th></th>
          <th></th>
          <th title='1 Week Planned Stock Ratio'>
            {/* <span className="th-full">1 Week</span> */}
            <span className="th-short">1wk</span>
          </th>
          <th title='2 Weeks Planned Stock Ratio'>
            {/* <span className="th-full">2 Weeks</span> */}
            <span className="th-short">2wks</span>
          </th>
          <th title='3 Weeks Planned Stock Ratio'>
            {/* <span className="th-full">3 Weeks</span> */}
            <span className="th-short">3wks</span>
          </th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {data.map((item, i) => {
            // Insert subtotal row before each gap
            if (item.isGap) {
              const prevGapIdx = gapIndices.filter(idx => idx < i).pop() ?? -1;
              const subtotalStock = sumSection(prevGapIdx + 1, i, 'total');
              const subtotalOnOrder1 = sumSection(prevGapIdx + 1, i, 'onOrder1');
              const subtotalOnOrder2 = sumSection(prevGapIdx + 1, i, 'onOrder2');
              const subtotalOnOrder3 = sumSection(prevGapIdx + 1, i, 'onOrder3');

              return (
                <React.Fragment key={`subtotal-gap-${i}`}>
                  <tr className="subtotalRow">
                    <td><strong>Subtotal</strong></td>
                    <td><strong>{subtotalStock}</strong></td>
                    <td><strong>{subtotalOnOrder1}</strong></td>
                    <td><strong>{subtotalOnOrder2}</strong></td>
                    <td><strong>{subtotalOnOrder3}</strong></td>
                    <td></td>
                  </tr>
                  <tr key={`gap-${i}`} className="sleeve-gap-row">
                    <td></td>
                  </tr>
                </React.Fragment>
              );
            }

          return (
            <tr key={i} style={{ backgroundColor: `${item.color}30` }}>
              <td className="pizza-id-cell" >
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
                {showPercent
                  ? (sleeveOnOrderTotals[item.sleeveType]?.w1
                      ? Math.round((item.onOrder1 / sleeveOnOrderTotals[item.sleeveType].w1) * 100) + '%'
                      : '0%')
                  : item.onOrder1}
              </td>
              <td>                {showPercent
                  ? (sleeveOnOrderTotals[item.sleeveType]?.w2
                      ? Math.round((item.onOrder2 / sleeveOnOrderTotals[item.sleeveType].w2) * 100) + '%'
                      : '0%')
                  : item.onOrder2}
              </td>
              <td>
                                {showPercent
                  ? (sleeveOnOrderTotals[item.sleeveType]?.w3
                      ? Math.round((item.onOrder3 / sleeveOnOrderTotals[item.sleeveType].w3) * 100) + '%'
                      : '0%')
                  : item.onOrder3}
              </td>
              <td className="statusCell">
                <span className="statusFull">{item.status}</span>
                <span className="statusShort">{getShortStatus(item.status)}</span>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default StockTable;
