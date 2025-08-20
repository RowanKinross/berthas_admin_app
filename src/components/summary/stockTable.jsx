import React from 'react';

function StockTable({ data, showPercent = true }) {
  if (!data || data.length === 0) {
    return <p>Loading stock...</p>;
  }

  return (
    <table className="stock-table">
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
              <td>{item.onOrder1 ?? 0}</td>
              <td>{item.onOrder2 ?? 0}</td>
              <td>{item.onOrder3 ?? 0}</td>
              <td>TBC</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default StockTable;
