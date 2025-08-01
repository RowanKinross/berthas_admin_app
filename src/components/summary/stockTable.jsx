import React from 'react';

function StockTable({ data }) {
  if (!data || data.length === 0) {
    return <p>Loading or no stock available.</p>;
  }

  return (
    <table className="stock-table">
      <thead>
        <tr>
          <th>Pizza</th>
          <th>Pizza ID</th>
          <th>Available Stock</th>
          <th>On Order</th>
          <th>Ratio</th>
          <th>Stock Status</th>
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
        <tr
          key={i}
          style={{ backgroundColor: `${item.color}30` }}
        >
          <td 
            style={{ backgroundColor: `${item.color}70`}}
            className='pizzaTitle'
          >{item.name}</td>
          <td>{item.id}</td>
          <td>{item.available}</td>
          <td>{item.onOrder}</td>
          <td>{item.ratio}</td>
          <td>TBC</td>
        </tr>
          );
        })}
      </tbody>
    </table>
  );
}


export default StockTable;
