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
          if (item.isGap) {
            return (
              <tr key={`gap-${i}`} className="sleeve-gap-row">
                <td></td>
              </tr>
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
                {showPercent && item.ratio != null
                  ? `${item.ratio}%`
                  : item.total}
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
