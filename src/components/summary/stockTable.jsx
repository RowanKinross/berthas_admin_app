import React from 'react';

function StockTable({ data }) {
  if (!data || data.length === 0) {
    return <p>Loading or no stock available.</p>;
  }

  return (
    <table className="stock-table">
      <thead>
        <tr>
          <th></th>
          <th>Stock</th>
          <th>Ordered</th>
          <th>Ratio</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        {data.map((item, i) => {
          if (item.isGap) {
            return (
              <tr key={`gap-${i}`} className="sleeve-gap-row">
                <td colSpan="6" style={{ height: '1rem' }}></td>
              </tr>
            );
          }

  return (
        <tr key={i} style={{ backgroundColor: `${item.color}30` }}>
          <td className="pizza-id-cell" >
            <span className="pizzaBadge" title={item.name} style={{ backgroundColor: `${item.color}70`}}>
              {item.name}
            </span>
            {item.id}
          </td>
          <td>{item.available}</td>
          <td>{item.onOrder}</td>
          <td>{typeof item.ratio === 'number' ? `${item.ratio}%` : ''}</td>
          <td>TBC</td>
        </tr>
          );
        })}
      </tbody>
    </table>
  );
}


export default StockTable;
