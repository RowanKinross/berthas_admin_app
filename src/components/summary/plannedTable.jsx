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
          <th>Pizza</th>
          <th>Pizza ID</th>
          <th>Planned Stock</th>
          {/* <th>On Order</th> */}
          <th>New Ratio</th>
          {/* <th>Stock Status</th> */}
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
                style={{ backgroundColor: `${item.color}70` }}
                className='pizzaTitle'
              >
                {item.name}
              </td>
              <td>{item.id}</td>
              <td>{item.available}</td>
              {/* <td>{item.onOrder}</td> */}
              <td>{typeof item.ratio === 'number' ? `${item.ratio}%` : ''}</td>
              {/* <td>Planned</td> */}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

export default PlannedTable;