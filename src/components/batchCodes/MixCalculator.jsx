import React, { useState, useEffect } from 'react';
import { Form, Row, Col, Table } from 'react-bootstrap';
import './MixCalculator.css';

const MixCalculator = ({ onTotalsChange }) => {
  // Mix size data
  const mixSizes = [
    { name: 'Top up', water: 300, starter: 80, rye: 215, caputo: 215 },
    { name: '50kg (3%)', water: 560, starter: 150, rye: 400, caputo: 400 },
    { name: '45kg (3%)', water: 510, starter: 135, rye: 360, caputo: 360 },
    { name: '35kg (3%)', water: 400, starter: 110, rye: 275, caputo: 275 },
    { name: '30kg (3%)', water: 340, starter: 90, rye: 240, caputo: 240 },
    { name: '15kg (3%)', water: 170, starter: 45, rye: 120, caputo: 120 },
    { name: '30kg Dough Balls (10%)', water: 1120, starter: 300, rye: 800, caputo: 800 }
  ];

  // State for quantities of each mix size
  const [quantities, setQuantities] = useState(
    mixSizes.reduce((acc, size) => {
      acc[size.name] = size.name === 'Top up' ? 1 : 0;
      return acc;
    }, {})
  );

  // Calculate totals
  const calculateTotals = () => {
    const totals = { water: 0, starter: 0, rye: 0, caputo: 0 };
    
    mixSizes.forEach(size => {
      const qty = quantities[size.name] || 0;
      totals.water += size.water * qty;
      totals.starter += size.starter * qty;
      totals.rye += size.rye * qty;
      totals.caputo += size.caputo * qty;
    });
    
    return totals;
  };

  const totals = calculateTotals();

  // Update parent component when totals change
  useEffect(() => {
    if (onTotalsChange) {
      onTotalsChange(totals);
    }
  }, [totals, onTotalsChange]);

  const handleQuantityChange = (sizeName, value) => {
    setQuantities(prev => ({
      ...prev,
      [sizeName]: parseInt(value) || 0
    }));
  };

  const hasAnyQuantity = Object.values(quantities).some(qty => qty > 0);

  return (
    <div className="mix-calculator-container">      
      {/* Input Grid */}
      <Row className="mb-3">
        {mixSizes.map(size => (
          <Col key={size.name} sm={6} md={4} lg={3} className="mb-2">
            <Form.Group>
              <Form.Label className="mix-input-label">
                {size.name}
              </Form.Label>
              <Form.Control
                type="number"
                min="0"
                value={quantities[size.name]}
                onChange={(e) => handleQuantityChange(size.name, e.target.value)}
                className="mix-input"
              />
            </Form.Group>
          </Col>
        ))}
      </Row>

      {/* Results Table */}
      {hasAnyQuantity && (
        <div className="mix-results-section">
          <Table striped bordered size="sm" className="mix-results-table">
            <tbody>
              <tr>
                <td><strong>70% Water</strong></td>
                <td>{totals.water.toLocaleString()}</td>
              </tr>
              <tr>
                <td><strong>19% Starter</strong></td>
                <td>{totals.starter.toLocaleString()}</td>
              </tr>
              <tr>
                <td><strong>50% Rye</strong></td>
                <td>{totals.rye.toLocaleString()}</td>
              </tr>
              <tr>
                <td><strong>50% Caputo</strong></td>
                <td>{totals.caputo.toLocaleString()}</td>
              </tr>
            </tbody>
          </Table>
        </div>
      )}

      {/* Quick Example */}
      {!hasAnyQuantity && (
        <div className="mix-example-text">
          Enter quantities above to calculate starter size needed
          e.g 1 x Top up + 3 × 45kg + 1 × 50kg
        </div>
      )}
    </div>
  );
};

export default MixCalculator;